import React from 'react';
import { Helmet } from 'react-helmet-async';
import GlassCard from '@/ui-kit/GlassCard/GlassCard';
import { artOfLife } from './artOfLife.data';
import { safeHtml } from '@/lib/safeHtml';
import styles from './ArtOfLifeTab.module.css';

const ArtOfLifeTab = () => (
  <>
    <Helmet>
      <title>Art of Life – Scott Sun</title>
      <meta name="description" content="Musings on life, philosophy, and purpose." />
    </Helmet>
    
    <div className="art-of-life-tab space-y-8">
      <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">
        Art of Life
      </h1>
      
      {artOfLife.map((item, i) => (
        <GlassCard 
          key={item.id}
          className="rounded-2xl overflow-hidden fade-in"
          style={{ animationDelay: i === 0 ? '0.4s' : '0.2s' }}>
          <div className="p-5 md:p-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-200">
              {item.title}
            </h2>
            <p className="text-white text-base md:text-lg leading-relaxed"
               dangerouslySetInnerHTML={safeHtml(item.description)} />
          </div>
        </GlassCard>
      ))}
    </div>
  </>
);

export default ArtOfLifeTab; 