import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import './Footer.module.css';

const Footer = () => {
  return (
    <footer className="footer-container py-8 mt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <span>Made with</span>
            <FontAwesomeIcon 
              icon={faHeart} 
              className="text-red-400 animate-pulse" 
            />
            <span>by Scott Sun</span>
          </div>
          
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} Scott Sun. All rights reserved.
          </div>
          
          <div className="text-xs text-gray-600">
            Built with React, Vite, and Framer Motion
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 