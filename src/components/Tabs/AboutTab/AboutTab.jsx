import React from 'react';
import GlassCard from '../../common/GlassCard/GlassCard';

const AboutTab = () => {
  return (
    <div className="about-tab space-y-8">
      <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">Techno Optimist</h1>
      
      <GlassCard className="rounded-2xl p-8 fade-in">
        <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-200 text-left">Into The Unknown</h2>
        <p className="text-lg text-white font-bold italic leading-relaxed mb-8 text-left">
        <br />From the infinite potential of energy to the total actualization of entropy, <span className="highlight-glow text-xl">intelligence</span> charts a course for the pursuit of <span className="highlight-glow text-xl">meaning</span>, <span className="highlight-glow text-xl">mission</span> and <span className="highlight-glow text-xl">love</span>.<br /><br />
        </p>
        <p 
          className="text-lg text-white leading-relaxed text-left"
          dangerouslySetInnerHTML={{ 
            __html: `I believe that all problems are eventually solvable through technology without introducing any additional externality. Technology evolves—gradually or rapidly—to match the complexity of problems. Today's flawed solutions will never capture how easily these problems may be resolved in the future.<br /><br />

            Technology emerges from the interactions between intelligent entities and the universe they inhabit, while intelligence improves and evolves through technology. Technology is not only an external manifestation of intelligence but it stands as the ultimate culmination.<br /><br />

            Intelligence is the meta-problem underlying all challenges. Once intelligence is solved, we indirectly unlock solutions to every problem. The acceleration of ASI injects a second-order surge into all frontier sciences and engineering, placing us at an inflection point where the future will be unrecognizably better.<br /><br />

            The exponential growth of compute power, digital data & artifacts, and nn-based AI signals a broad intelligence revolution in both scale and depth.<br /><br />

            Technology has also been historically proven to be the only robust, consistent, and effective means to combat various social disparities, both directly and indirectly.<br /><br />

            Acceleration follows an exponential curve while human imagination remains confined to linear velocity. A fundamental transformation may be daunting, yet it is equally if not more exhilarating, for the only way forward is <span class="eater-regular text-xl">into the unknown</span> <i class="fa-solid fa-ghost"></i>.`
          }}
        />
      </GlassCard>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <GlassCard className="rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-200 text-left">My Mission</h3>
          <p className="text-white leading-relaxed text-left">Intelligence is the scaffold upon which we build the future of business and society. When intelligence can be artificially created and arbitrarily duplicated, this scaffold gains the capacity to extend beyond imagination. <span className="font-bold text-yellow-200">My role is to be a builder on this scaffold – crafting useful tools that fundamentally reconstruct how we think about tech business logic, product-market fit, operational excellence, and resource allocation.</span> I want to reimagine these foundational elements in light of our new technological capabilities. I want to be a part of this profound intelligence revolution in how we create and capture value. <span className="font-bold text-yellow-200">The techno-capital engine is leading the charge, and I am an agent of change.</span> The impact will not be immediate, but it will be impossible to ignore.</p>
        </GlassCard>
        
        <GlassCard className="rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-200 text-left">Source of Strength</h3>
          <p className="text-white leading-relaxed text-left">At the moment the pace of AI innovation demands constant evolution of understanding. <span className="font-bold text-yellow-200">The source of my strength is continuous and constant learning and researching in cyclic feedback, from the latest AI research papers on arXiv to the extraordinary projects and tools on GitHub, from the immediate first-hand discussions and demos on 𝕏 to the deep dives in podcasts, blog posts, and books.</span> I live at the intersection of AI research, product development, tech industry strategy, and VC/startups – fields that are mutually reinforcing. Yesterday's cutting-edge is today's baseline. The value of following these developments and understanding them deeply compounds over time, creating unmatched insights for decision-making and innovation.</p>
        </GlassCard>
      
        <GlassCard className="rounded-xl p-6 md:col-span-2">
          <h3 className="text-xl font-bold mb-4 text-gray-200 text-left">I'm on</h3>
          <div className="flex flex-col space-y-4">
            {/* X (Twitter) Link */}
            <a 
              href="https://x.com/scottstts" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="group flex items-center space-x-3 p-3 rounded-xl border border-transparent transition-all duration-200 hover:bg-purple-900/30 hover:border-purple-300"
            >
              <i className="fa-brands fa-square-x-twitter text-2xl md:text-3xl text-purple-300 group-hover:text-purple-200"></i>
              <span className="text-xl text-purple-300 group-hover:text-purple-200">@scottstts</span>
            </a>

            {/* LinkedIn Link */}
            <a 
              href="https://www.linkedin.com/in/st-scottsun-inireland/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="group flex items-center space-x-3 p-3 rounded-xl border border-transparent transition-all duration-200 hover:bg-blue-900/30 hover:border-blue-300"
            >
              <i className="fa-brands fa-linkedin text-2xl md:text-3xl text-blue-400 group-hover:text-blue-300"></i>
              <span className="text-xl text-blue-400 group-hover:text-blue-300">Scott Sun</span>
            </a>

            <a 
              href="https://github.com/scottstts" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="group flex items-center space-x-3 p-3 rounded-xl border border-transparent transition-all duration-200 hover:bg-white/30 hover:border-white"
            >
              <i className="fa-brands fa-github text-2xl md:text-3xl text-white group-hover:text-white"></i>
              <span className="text-xl text-white group-hover:text-white">scottstts</span>
            </a>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default AboutTab; 