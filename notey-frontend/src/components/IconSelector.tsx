import React, { useState } from 'react';

interface IconSelectorProps {
  selectedIcon: string;
  onIconChange: (icon: string) => void;
  className?: string;
}

const PRESET_ICONS = [
  'tag', 'star', 'heart', 'bookmark', 'flag', 'check', 'times', 'plus', 'minus',
  'eye', 'eye-slash', 'lock', 'unlock', 'key', 'cog', 'wrench', 'tools', 'search',
  'home', 'user', 'users', 'calendar', 'clock', 'map-marker', 'phone', 'envelope',
  'link', 'external-link-alt', 'download', 'upload', 'share', 'copy', 'paste',
  'cut', 'edit', 'trash', 'save', 'folder', 'file', 'image', 'video', 'music',
  'play', 'pause', 'stop', 'forward', 'backward', 'volume-up', 'volume-down',
  'mute', 'microphone', 'headphones', 'camera', 'mobile', 'tablet', 'laptop',
  'desktop', 'server', 'database', 'cloud', 'wifi', 'bluetooth', 'battery-full',
  'battery-half', 'battery-empty', 'plug', 'bolt', 'fire', 'leaf', 'tree', 'sun',
  'moon', 'cloud-sun', 'cloud-rain', 'snowflake', 'umbrella', 'tint', 'wind'
];

export const IconSelector: React.FC<IconSelectorProps> = ({
  selectedIcon,
  onIconChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIcons = PRESET_ICONS.filter(icon =>
    icon.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleIconSelect = (icon: string) => {
    onIconChange(icon);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <i className={`fas fa-${selectedIcon} text-gray-600`} />
        <span className="text-sm text-gray-700">{selectedIcon}</span>
        <i className="fas fa-chevron-down text-xs text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-80 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Icons
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for an icon..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Icon
              </label>
              <div className="grid grid-cols-8 gap-2 max-h-60 overflow-y-auto">
                {filteredIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => handleIconSelect(icon)}
                    className={`w-10 h-10 flex items-center justify-center border-2 rounded transition-all duration-200 hover:scale-110 ${
                      selectedIcon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    aria-label={`Select ${icon} icon`}
                  >
                    <i className={`fas fa-${icon} text-gray-600`} />
                  </button>
                ))}
              </div>
              
              {filteredIcons.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No icons found matching "{searchTerm}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
