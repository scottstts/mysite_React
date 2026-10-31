import type { AboutContent } from '@/types/content';

// `lead` and `body` accept the same inline HTML as the other data files.
// Wrap a word in <span class="highlight-glow"> to set it in the lead's italic.
export const about: AboutContent = {
  title: 'Techno Optimist',
  heading: 'Into The Unknown',
  lead: `From the infinite potential of energy to the total actualization of entropy, <span class="highlight-glow">intelligence</span> charts a course for the pursuit of <span class="highlight-glow">meaning</span>, <span class="highlight-glow">mission</span> and <span class="highlight-glow">love</span>.`,
  body: `I believe that all problems are eventually solvable through technology without introducing any additional externality. Technology evolves—gradually or rapidly—to match the complexity of problems. Today's flawed solutions will never capture how easily these problems may be resolved in the future.<br /><br />

Technology emerges from the interactions between intelligent entities and the universe they inhabit, while intelligence improves and evolves through technology. Technology is not only an external manifestation of intelligence but it stands as the ultimate culmination.<br /><br />

Intelligence is the meta-problem underlying all challenges. Once intelligence is solved, we indirectly unlock solutions to every problem. The acceleration of ASI injects a second-order surge into all frontier sciences and engineering, placing us at an inflection point where the future will be unrecognizably better.<br /><br />

The exponential growth of compute power, digital data and artifacts, and nn-based AI signals a broad intelligence revolution in both scale and depth.<br /><br />

Technology has also been historically proven to be the only robust, consistent, and effective means to combat various social disparities, both directly and indirectly.<br /><br />

Acceleration follows an exponential curve while human imagination remains confined to linear velocity. A fundamental transformation may be daunting, yet it is equally if not more exhilarating, for the only way forward is <span class="eater-regular">into the unknown</span>.`,
  socialsHeading: 'Find me on',
  // `icon` is any Font Awesome Free 6 icon's classes (https://fontawesome.com/search?ic=free),
  // the same as <i class="…"> icons in the text; it's built into the site as
  // inline SVG, nothing else to install.
  socials: [
    {
      name: 'GitHub',
      handle: 'scottstts',
      href: 'https://github.com/scottstts',
      icon: 'fa-brands fa-github',
    },
    {
      name: 'X',
      handle: '@scottstts',
      href: 'https://x.com/scottstts',
      icon: 'fa-brands fa-x-twitter',
    },
    {
      name: 'Instagram',
      handle: '@scottstts',
      href: 'https://www.instagram.com/scottstts/',
      icon: 'fa-brands fa-instagram',
    },
    {
      name: 'LinkedIn',
      handle: 'Scott Sun',
      href: 'https://www.linkedin.com/in/st-scottsun-inireland/',
      icon: 'fa-brands fa-linkedin-in',
    },
  ],
};
