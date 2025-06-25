import React from 'react';
import GlassCard from '../../common/GlassCard/GlassCard';
import { inspirations } from '../../../data/inspirations';
import './InspirationsTab.module.css';

const InspirationsTab = () => {
  return (
    <div className="inspirations-tab space-y-8">
      <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">My Inspirations</h1>
      
      <div className="space-y-12">
        {inspirations.map((inspiration, index) => (
          <GlassCard key={inspiration.id} className="rounded-2xl p-8 fade-in">
            <div className="space-y-8">
              {/* Content */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-200 mb-2 text-left">
                    {inspiration.name}
                  </h2>
                  <p className="text-lg text-yellow-300 font-semibold italic leading-relaxed text-left">
                    "{inspiration.tagline}"
                  </p>
                </div>
                
                <div className="space-y-4 mb-8">
                  {inspiration.description.split('\n\n').map((paragraph, pIndex) => (
                    <p key={pIndex} className="text-white leading-relaxed text-left">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              {/* Image */}
              <div className="flex items-center justify-center mt-8">
                <div className="w-full max-w-md">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-black/20">
                    <img
                      src={`/static_assets/${inspiration.image}`}
                      alt={inspiration.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        ))}

        {/* Final quote card */}
        <GlassCard className="rounded-2xl overflow-hidden fade-in p-8 text-left" style={{animationDelay: '0.6s'}}>
          <p className="text-xl md:text-2xl text-yellow-100">
            I'm grateful that they exist. Our timeline is infinitely better with them in it. And whenever life gets difficult, which is often, I receive visceral strength and courage watching their brilliance and hard work in action! <i className="fa-regular fa-heart"></i>
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

export default InspirationsTab; 