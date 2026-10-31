import { safeHtml } from '@/lib/safeHtml';
import Paragraphs from '@/ui-kit/Paragraphs/Paragraphs';
import Reel from '@/ui-kit/Reel/Reel';
import { apps } from '@/features/portfolio/apps.data';
import { journey } from '@/features/journey/journey.data';
import type { VideoSlideData } from '@/types/content';
import { about } from './about.data';
import { aboutHighlight } from './highlight.data';
import Icon from '@/ui-kit/Icon/Icon';

// A highlight film keeps the title it has elsewhere on the site; a film that
// isn't anywhere else takes YouTube's own title.
const knownVideos = [...apps, ...journey].flatMap(
  (entry) => entry.videos ?? []
);
const highlightVideos: VideoSlideData[] = aboutHighlight.youtubeIds
  .map((id) => id.trim())
  .filter((id) => /^[a-zA-Z0-9_-]{11}$/.test(id))
  .map(
    (id) =>
      knownVideos.find((video) => video.videoId === id) ?? {
        videoId: id,
        title: '',
      }
  );

const AboutTab = () => {
  return (
    <>
      <div className="grid about-hero">
        <h1 className="smallcaps">{about.title}</h1>
        <p className="lead" dangerouslySetInnerHTML={safeHtml(about.lead)} />
      </div>
      <div className="grid essay">
        <h2>{about.heading}</h2>
        <Paragraphs html={about.body} />
      </div>
      <div className="grid feature">
        <div className="media">
          <Reel videos={highlightVideos} />
        </div>
        <div className="copy">
          <h2>{aboutHighlight.title}</h2>
          <p>{aboutHighlight.description}</p>
        </div>
      </div>
      <div className="grid social">
        <h2 className="smallcaps">{about.socialsHeading}</h2>
        <ul>
          {about.socials.map((social) => (
            <li key={social.href}>
              <a href={social.href} target="_blank" rel="noopener noreferrer">
                <span className="ic">
                  <Icon name={social.icon} />
                </span>
                <span className="tx">
                  <b>{social.name}</b>
                  <small>{social.handle}</small>
                </span>
                {/* drawn, not a character: phones render ↗ as an emoji */}
                <svg className="go" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 9 9 3M4 3h5v5" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="about-tail" />
    </>
  );
};

export default AboutTab;
