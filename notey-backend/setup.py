"""
Setup script for Notey Backend
A FastAPI-based backend for the Notey audio note-taking platform
"""

from setuptools import setup, find_packages
import os

# Read the README file
def read_readme():
    with open("README.md", "r", encoding="utf-8") as fh:
        return fh.read()

# Read requirements
def read_requirements():
    with open("requirements.txt", "r", encoding="utf-8") as fh:
        return [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="notey-backend",
    version="1.0.0",
    author="Notey Team",
    author_email="team@notey.app",
    description="AI-Powered Audio Note Taking Platform Backend",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    url="https://github.com/notey-team/notey-backend",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Framework :: FastAPI",
        "Topic :: Multimedia :: Sound/Audio :: Analysis",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.9",
    install_requires=read_requirements(),
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "isort>=5.12.0",
            "flake8>=6.0.0",
            "mypy>=1.0.0",
        ],
        "test": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.0.0",
            "httpx>=0.25.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "notey-backend=main:main",
        ],
    },
    include_package_data=True,
    package_data={
        "": ["*.md", "*.txt", "*.sql"],
    },
    keywords="audio, transcription, ai, notes, fastapi, python",
    project_urls={
        "Bug Reports": "https://github.com/notey-team/notey-backend/issues",
        "Source": "https://github.com/notey-team/notey-backend",
        "Documentation": "https://github.com/notey-team/notey-backend#readme",
    },
)

