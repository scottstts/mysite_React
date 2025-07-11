import React from 'react';
import { Helmet } from 'react-helmet-async';
import GlassCard from '@/ui-kit/GlassCard/GlassCard';
import ImageSlider from '@/ui-kit/ImageSlider/ImageSlider';
import { apps } from './apps.data';
import { safeHtml } from '@/lib/safeHtml';

const AppsTab = () => {
  return (
    <>
      <Helmet>
        <title>Apps - Scott Sun</title>
        <meta
          name="description"
          content="Scott Sun's apps and projects - Vacation Planner and Transcrilate. Practical solutions built with modern technologies."
        />
      </Helmet>
      <div className="apps-tab space-y-8">
        <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">
          My Apps
        </h1>

        {apps.map((app, index) => (
          <GlassCard
            key={app.id}
            className="rounded-2xl overflow-hidden fade-in"
            style={{ animationDelay: index === 0 ? '0.4s' : '0.2s' }}
          >
            <div className="p-5 md:p-8">
              {/* Title */}
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-200 text-left">
                {app.title}
              </h2>

              {/* Description */}
              <p className="text-white text-base md:text-lg mb-8 leading-relaxed text-left">
                <span className="font-semibold text-yellow-200">
                  {app.tagline}
                </span>
                <br />
                <br />
                <span dangerouslySetInnerHTML={safeHtml(app.description)} />
              </p>

              {/* Slider Container */}
              {app.images && app.images.length > 0 && (
                <div className="relative mt-8">
                  <div className="slider-container p-3 md:p-4">
                    <ImageSlider
                      images={app.images}
                      videos={[]}
                      projectId={app.projectId}
                      autoplay={true}
                      autoplayDelay={4000}
                    />
                  </div>
                </div>
              )}

              {/* Button */}
              <div className="mt-6 text-left">
                <a
                  href={app.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-button inline-flex items-center px-6 py-3 text-base md:text-lg font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 transition-all duration-200"
                >
                  Check out {app.title}
                </a>
              </div>
            </div>
          </GlassCard>
        ))}

        {/* Future Project Teaser */}
        <GlassCard
          className="rounded-2xl overflow-hidden fade-in p-8 text-center"
          style={{ animationDelay: '0.6s' }}
        >
          <p
            className="text-xl md:text-2xl text-yellow-100"
            dangerouslySetInnerHTML={safeHtml(
              `I'm sure a new idea will hit me soon... <i class="fa-solid fa-face-laugh-wink" aria-hidden="true"></i>`
            )}
          />
        </GlassCard>
      </div>
    </>
  );
};

export default AppsTab;
