import { Helmet } from 'react-helmet-async';
import GlassCard from '@/ui-kit/GlassCard/GlassCard';
import SocialConstellation from './SocialConstellation';
import AboutHighlight from './AboutHighlight';
import { safeHtml } from '@/lib/safeHtml';

const AboutTab = () => {
  return (
    <>
      <Helmet>
        <title>About - Scott Sun</title>
        <meta
          name="description"
          content="Scott Sun | Frontier AI Chaser and Builder. Techno Optimist. Learn about my mission and source of strength."
        />
      </Helmet>
      <div className="about-tab space-y-8">
        <h1 className="page-title text-4xl md:text-5xl font-bold text-center mb-12 fade-in">
          Techno Optimist
        </h1>

        <GlassCard className="rounded-2xl p-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-200 text-left">
            Into The Unknown
          </h2>
          <p className="text-lg text-white font-bold italic leading-relaxed mb-8 text-left">
            <br />
            From the infinite potential of energy to the total actualization of
            entropy,{' '}
            <span className="highlight-glow text-xl">intelligence</span> charts
            a course for the pursuit of{' '}
            <span className="highlight-glow text-xl">meaning</span>,{' '}
            <span className="highlight-glow text-xl">mission</span> and{' '}
            <span className="highlight-glow text-xl">love</span>.<br />
            <br />
          </p>
          <p
            className="text-lg text-white leading-relaxed text-left"
            dangerouslySetInnerHTML={safeHtml(`I believe that all problems are eventually solvable through technology without introducing any additional externality. Technology evolves—gradually or rapidly—to match the complexity of problems. Today's flawed solutions will never capture how easily these problems may be resolved in the future.<br /><br />

            Technology emerges from the interactions between intelligent entities and the universe they inhabit, while intelligence improves and evolves through technology. Technology is not only an external manifestation of intelligence but it stands as the ultimate culmination.<br /><br />

            Intelligence is the meta-problem underlying all challenges. Once intelligence is solved, we indirectly unlock solutions to every problem. The acceleration of ASI injects a second-order surge into all frontier sciences and engineering, placing us at an inflection point where the future will be unrecognizably better.<br /><br />

            The exponential growth of compute power, digital data and artifacts, and nn-based AI signals a broad intelligence revolution in both scale and depth.<br /><br />

            Technology has also been historically proven to be the only robust, consistent, and effective means to combat various social disparities, both directly and indirectly.<br /><br />

            Acceleration follows an exponential curve while human imagination remains confined to linear velocity. A fundamental transformation may be daunting, yet it is equally if not more exhilarating, for the only way forward is <span class="eater-regular text-xl">into the unknown</span>.`)}
          />
        </GlassCard>

        <AboutHighlight />

        <SocialConstellation />
      </div>
    </>
  );
};

export default AboutTab;
