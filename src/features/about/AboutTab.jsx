import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import GlassCard from '@/ui-kit/GlassCard/GlassCard';
import { safeHtml } from '@/lib/safeHtml';

const IM_ON_ILLUSTRATION = '/static_assets/logo.png';
const SCANLINE_SLICE_COUNT = 200;
const SCANLINE_DURATION = 4; // seconds

const AboutTab = () => {
  const linksRef = useRef(null);
  const glitchContainerRef = useRef(null);
  const [imageHeight, setImageHeight] = useState('auto');
  const [glitchSize, setGlitchSize] = useState({ width: 0, height: 0 });

  const updateGlitchSize = useCallback(() => {
    const container = glitchContainerRef.current;

    if (!container) {
      return;
    }

    const { offsetWidth, offsetHeight } = container;
    const nextWidth = offsetWidth;
    const nextHeight = offsetHeight;

    setGlitchSize((previous) => {
      if (previous.width === nextWidth && previous.height === nextHeight) {
        return previous;
      }

      return {
        width: nextWidth,
        height: nextHeight,
      };
    });
  }, []);

  const scanlineSlices = useMemo(() => {
    if (!glitchSize.width || !glitchSize.height) {
      return [];
    }

    const sliceHeightPx = glitchSize.height / SCANLINE_SLICE_COUNT;
    const backgroundSize = `${glitchSize.width}px ${glitchSize.height}px`;

    return Array.from({ length: SCANLINE_SLICE_COUNT }, (_, index) => {
      const delay = (-SCANLINE_DURATION / SCANLINE_SLICE_COUNT) * index;
      const topPx = sliceHeightPx * index;
      const backgroundOffsetPx = -topPx;

      return (
        <span
          key={index}
          className="cybr-glitch-img__scanline"
          aria-hidden="true"
          style={{
            top: `${topPx}px`,
            height: `${sliceHeightPx}px`,
            backgroundImage: `url(${IM_ON_ILLUSTRATION})`,
            backgroundSize,
            backgroundPosition: `0px ${backgroundOffsetPx}px`,
            '--glitch-offset-y': `${backgroundOffsetPx}px`,
            animationDelay: `${delay}s`,
            animationDuration: `${SCANLINE_DURATION}s`,
          }}
        />
      );
    });
  }, [glitchSize.height, glitchSize.width]);

  const updateImageHeight = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const isDesktop = window.matchMedia('(min-width: 768px)').matches;

    if (isDesktop && linksRef.current) {
      setImageHeight(linksRef.current.offsetHeight);
    } else {
      setImageHeight('auto');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    updateImageHeight();

    window.addEventListener('resize', updateImageHeight);

    let observer;
    if ('ResizeObserver' in window && linksRef.current) {
      observer = new ResizeObserver(() => updateImageHeight());
      observer.observe(linksRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateImageHeight);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [updateImageHeight]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    updateGlitchSize();

    window.addEventListener('resize', updateGlitchSize);

    let observer;
    if ('ResizeObserver' in window && glitchContainerRef.current) {
      observer = new ResizeObserver(() => updateGlitchSize());
      observer.observe(glitchContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateGlitchSize);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [updateGlitchSize]);

  const handleImageLoad = useCallback(() => {
    updateImageHeight();
    updateGlitchSize();
  }, [updateGlitchSize, updateImageHeight]);

  const imageStyle = {
    ...(imageHeight === 'auto' ? {} : { height: `${imageHeight}px` }),
  };

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

        <GlassCard className="rounded-2xl p-8 fade-in">
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

            The exponential growth of compute power, digital data & artifacts, and nn-based AI signals a broad intelligence revolution in both scale and depth.<br /><br />

            Technology has also been historically proven to be the only robust, consistent, and effective means to combat various social disparities, both directly and indirectly.<br /><br />

            Acceleration follows an exponential curve while human imagination remains confined to linear velocity. A fundamental transformation may be daunting, yet it is equally if not more exhilarating, for the only way forward is <span class="eater-regular text-xl">into the unknown</span> <i class="fa-solid fa-ghost" aria-hidden="true"></i>.`)}
          />
        </GlassCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlassCard className="rounded-xl p-6 md:col-span-2">
            <h3 className="text-xl font-bold mb-4 text-gray-200 text-left">
              I'm on
            </h3>
            <div className="flex flex-col md:flex-row gap-6 md:gap-10 md:items-start md:justify-between">
              <div ref={linksRef} className="flex flex-col space-y-4 flex-1">
                {/* X (Twitter) Link */}
                <a
                  href="https://x.com/scottstts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center space-x-3 p-3 rounded-xl border border-transparent transition-all duration-200 hover:bg-purple-900/30 hover:border-purple-300"
                >
                  <i
                    className="fa-brands fa-square-x-twitter text-2xl md:text-3xl text-purple-300 group-hover:text-purple-200"
                    aria-hidden="true"
                  ></i>
                  <span className="text-xl text-purple-300 group-hover:text-purple-200">
                    @scottstts
                  </span>
                </a>

                {/* LinkedIn Link */}
                <a
                  href="https://www.linkedin.com/in/st-scottsun-inireland/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center space-x-3 p-3 rounded-xl border border-transparent transition-all duration-200 hover:bg-blue-900/30 hover:border-blue-300"
                >
                  <i
                    className="fa-brands fa-linkedin text-2xl md:text-3xl text-blue-400 group-hover:text-blue-300"
                    aria-hidden="true"
                  ></i>
                  <span className="text-xl text-blue-400 group-hover:text-blue-300">
                    Scott Sun
                  </span>
                </a>

                <a
                  href="https://github.com/scottstts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center space-x-3 p-3 rounded-xl border border-transparent transition-all duration-200 hover:bg-white/30 hover:border-white"
                >
                  <i
                    className="fa-brands fa-github text-2xl md:text-3xl text-white group-hover:text-white"
                    aria-hidden="true"
                  ></i>
                  <span className="text-xl text-white group-hover:text-white">
                    scottstts
                  </span>
                </a>
              </div>

              <div className="flex justify-center md:justify-end items-start flex-shrink-0 md:pl-6">
                <div className="cybr-glitch-img" ref={glitchContainerRef}>
                  <img
                    src={IM_ON_ILLUSTRATION}
                    alt="Logo"
                    className="w-48 sm:w-56 md:w-auto max-w-full h-auto object-contain rounded-2xl cybr-glitch-img__base"
                    style={imageStyle}
                    loading="lazy"
                    onLoad={handleImageLoad}
                  />
                  <img
                    src={IM_ON_ILLUSTRATION}
                    alt=""
                    aria-hidden="true"
                    className="cybr-glitch-img__slice cybr-glitch-img__slice--cyan"
                    loading="lazy"
                  />
                  <img
                    src={IM_ON_ILLUSTRATION}
                    alt=""
                    aria-hidden="true"
                    className="cybr-glitch-img__slice cybr-glitch-img__slice--magenta"
                    loading="lazy"
                  />
                  <div
                    className="cybr-glitch-img__scanlines"
                    aria-hidden="true"
                    style={{
                      '--glitch-line-count': `${SCANLINE_SLICE_COUNT}`,
                      '--glitch-scanline-duration': `${SCANLINE_DURATION}s`,
                    }}
                  >
                    {scanlineSlices}
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
};

export default AboutTab;
