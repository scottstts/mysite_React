import React from 'react';
import { Helmet } from 'react-helmet-async';
import GlassCard from '@/ui-kit/GlassCard/GlassCard';
import ImageSlider from '@/ui-kit/ImageSlider/ImageSlider';
import { projects } from './projects.data';
import { safeHtml } from '@/lib/safeHtml';

const ProjectsTab = () => {
  return (
    <>
      <Helmet>
        <title>Projects - Scott Sun</title>
        <meta
          name="description"
          content="Scott Sun's learning journey and projects - from programming to deep learning, AI, Blender, Unity, and app development."
        />
      </Helmet>
      <div id="projects" className="projects-tab space-y-8">
        <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">
          Learning Journey
        </h1>

        {projects.map((project, _index) => (
          <GlassCard
            key={project.id}
            className="rounded-2xl overflow-hidden fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            <div className="p-5 md:p-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-200 text-left">
                {project.title}
                <span className="block text-xl md:text-2xl font-semibold text-yellow-200 italic text-right">
                  —{project.date}
                </span>
              </h2>
              <p
                className="text-white text-base md:text-lg mb-8 leading-relaxed text-left"
                dangerouslySetInnerHTML={safeHtml(project.description)}
              />

              {/* Slider Container */}
              {(project.images.length > 0 || project.videos.length > 0) && (
                <div className="slider-container p-3 md:p-4 mt-8">
                  <div className="relative">
                    <ImageSlider
                      images={project.images}
                      videos={project.videos}
                      projectId={project.projectId}
                      autoplay={true}
                      autoplayDelay={5000}
                    />
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        ))}

        {/* Final quote card */}
        <GlassCard
          className="rounded-2xl overflow-hidden fade-in p-8"
          style={{ animationDelay: '0.6s' }}
        >
          <p
            className="text-xl md:text-2xl text-yellow-100 mb-8 text-left"
            dangerouslySetInnerHTML={safeHtml(
              `I love this Naval tweet! There is immense joy for me in learning interesting and useful new things. I will never stop learning. It has been a long journey. I am super excited about what's to come <i class="fa-solid fa-fire" aria-hidden="true"></i>!`
            )}
          />
          <img
            src="/static_assets/naval_tweet.jpeg"
            loading="lazy"
            alt="naval_tweet"
            className="rounded-xl w-full object-cover mt-8"
          />
        </GlassCard>
      </div>
    </>
  );
};

export default ProjectsTab;
