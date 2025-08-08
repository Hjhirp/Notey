import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class VectorSearchService:
    """
    Vector-based semantic search service using sentence transformers.
    Enables semantic similarity matching instead of simple word matching.
    """
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the vector search service.
        
        Args:
            model_name: Name of the sentence transformer model to use
        """
        self.model_name = model_name
        self._model = None
        self._concept_embeddings = {}
        self._transcript_embeddings = {}
    
    @property
    def model(self) -> SentenceTransformer:
        """Lazy load the sentence transformer model."""
        if self._model is None:
            logger.info(f"Loading sentence transformer model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
        return self._model
    
    def encode_text(self, text: str) -> np.ndarray:
        """
        Encode text into vector embedding.
        
        Args:
            text: Input text to encode
            
        Returns:
            Vector embedding as numpy array
        """
        if not text or not text.strip():
            return np.zeros(384)  # Default embedding size for all-MiniLM-L6-v2
        
        return self.model.encode(text.strip(), convert_to_numpy=True)
    
    def encode_batch(self, texts: List[str]) -> np.ndarray:
        """
        Encode multiple texts into vector embeddings efficiently.
        
        Args:
            texts: List of texts to encode
            
        Returns:
            Matrix of embeddings (one per text)
        """
        if not texts:
            return np.array([])
        
        # Filter empty texts and keep track of indices
        valid_texts = []
        valid_indices = []
        
        for i, text in enumerate(texts):
            if text and text.strip():
                valid_texts.append(text.strip())
                valid_indices.append(i)
        
        if not valid_texts:
            return np.zeros((len(texts), 384))
        
        # Encode valid texts
        embeddings = self.model.encode(valid_texts, convert_to_numpy=True)
        
        # Create result matrix with zeros for empty texts
        result = np.zeros((len(texts), embeddings.shape[1]))
        for i, valid_idx in enumerate(valid_indices):
            result[valid_idx] = embeddings[i]
        
        return result
    
    def compute_similarity(self, query_embedding: np.ndarray, 
                          candidate_embeddings: np.ndarray) -> np.ndarray:
        """
        Compute cosine similarity between query and candidate embeddings.
        
        Args:
            query_embedding: Query vector
            candidate_embeddings: Matrix of candidate vectors
            
        Returns:
            Similarity scores (0-1, higher is more similar)
        """
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)
        
        if candidate_embeddings.ndim == 1:
            candidate_embeddings = candidate_embeddings.reshape(1, -1)
        
        similarities = cosine_similarity(query_embedding, candidate_embeddings)[0]
        
        # Convert to 0-1 range (cosine similarity is -1 to 1)
        similarities = (similarities + 1) / 2
        
        return similarities
    
    async def search_concepts(self, query: str, concepts: List[Dict[str, Any]], 
                            limit: int = 10, threshold: float = 0.3) -> List[Dict[str, Any]]:
        """
        Search concepts using semantic similarity.
        
        Args:
            query: Search query
            concepts: List of concept dictionaries with 'name' field
            limit: Maximum number of results to return
            threshold: Minimum similarity threshold (0-1)
            
        Returns:
            List of concepts with similarity scores
        """
        if not query or not concepts:
            return []
        
        try:
            # Encode query
            query_embedding = self.encode_text(query)
            
            # Encode concept names
            concept_texts = [concept.get('name', '') for concept in concepts]
            concept_embeddings = self.encode_batch(concept_texts)
            
            # Compute similarities
            similarities = self.compute_similarity(query_embedding, concept_embeddings)
            
            # Create results with similarity scores
            results = []
            for i, concept in enumerate(concepts):
                similarity = similarities[i]
                if similarity >= threshold:
                    result = concept.copy()
                    result['similarity_score'] = float(similarity)
                    results.append(result)
            
            # Sort by similarity (highest first) and limit
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return results[:limit]
        
        except Exception as e:
            logger.error(f"Error in semantic concept search: {e}")
            return []
    
    async def search_transcripts(self, query: str, transcripts: List[Dict[str, Any]], 
                               limit: int = 10, threshold: float = 0.3) -> List[Dict[str, Any]]:
        """
        Search transcripts using semantic similarity.
        
        Args:
            query: Search query
            transcripts: List of transcript/note dictionaries with 'transcript' or 'summary' fields
            limit: Maximum number of results to return
            threshold: Minimum similarity threshold (0-1)
            
        Returns:
            List of transcripts with similarity scores
        """
        if not query or not transcripts:
            return []
        
        try:
            # Encode query
            query_embedding = self.encode_text(query)
            
            # Encode transcript content (use summary if available, otherwise transcript)
            transcript_texts = []
            for transcript in transcripts:
                text = transcript.get('summary') or transcript.get('transcript', '')
                transcript_texts.append(text)
            
            transcript_embeddings = self.encode_batch(transcript_texts)
            
            # Compute similarities
            similarities = self.compute_similarity(query_embedding, transcript_embeddings)
            
            # Create results with similarity scores
            results = []
            for i, transcript in enumerate(transcripts):
                similarity = similarities[i]
                if similarity >= threshold:
                    result = transcript.copy()
                    result['similarity_score'] = float(similarity)
                    results.append(result)
            
            # Sort by similarity (highest first) and limit
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return results[:limit]
        
        except Exception as e:
            logger.error(f"Error in semantic transcript search: {e}")
            return []
    
    async def find_related_concepts(self, query: str, all_concepts: List[Dict[str, Any]], 
                                  limit: int = 5) -> List[str]:
        """
        Find concepts related to a query using semantic similarity.
        
        Args:
            query: Input query
            all_concepts: All available concepts to search through
            limit: Maximum number of related concepts to return
            
        Returns:
            List of related concept names
        """
        related = await self.search_concepts(query, all_concepts, limit=limit, threshold=0.2)
        return [concept['name'] for concept in related]

# Global instance
_vector_search_service = None

def get_vector_search_service() -> VectorSearchService:
    """Get the global vector search service instance."""
    global _vector_search_service
    if _vector_search_service is None:
        _vector_search_service = VectorSearchService()
    return _vector_search_service