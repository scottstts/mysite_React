import React from 'react';
import GlassCard from '@/ui-kit/GlassCard/GlassCard';
import { inspirations } from './inspirations.data';
import { safeHtml } from '@/lib/safeHtml';
import './InspirationsTab.module.css';

const InspirationsTab = () => {
  return (
    <div className="inspirations-tab space-y-8">
      <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">
        My Inspirations
      </h1>

      <div className="space-y-12">
        {inspirations.map((inspiration, _index) => (
          <GlassCard
            key={inspiration.id}
            className="rounded-2xl overflow-hidden fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="p-5 md:p-8">
              {/* Title */}
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-200">
                {inspiration.name}
              </h2>

              {/* Description */}
              <p
                className="text-white text-base md:text-lg mb-6 leading-relaxed"
                dangerouslySetInnerHTML={safeHtml(inspiration.description)}
              />

              {/* Image - matching original structure exactly */}
              <img
                src={`/static_assets/${inspiration.image}`}
                loading="lazy"
                alt={inspiration.name.toLowerCase()}
                className="rounded-xl w-full object-cover"
              />
            </div>
          </GlassCard>
        ))}

        {/* Final quote card */}
        <GlassCard
          className="rounded-2xl overflow-hidden fade-in p-8 text-left"
          style={{ animationDelay: '0.6s' }}
        >
          <p
            className="text-xl md:text-2xl text-yellow-100"
            dangerouslySetInnerHTML={safeHtml(
              `I'm grateful that they exist. Our timeline is infinitely better with them in it. And whenever life gets difficult, which is often, I receive visceral strength and courage watching their brilliance and hard work in action! <i class="fa-regular fa-heart"></i>`
            )}
          />
        </GlassCard>
      </div>
    </div>
  );
};

export default InspirationsTab;
