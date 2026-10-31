import { safeHtml } from '@/lib/safeHtml';
import Ending from '@/ui-kit/Ending/Ending';
import PrintStack from '@/ui-kit/PrintStack/PrintStack';
import Reel from '@/ui-kit/Reel/Reel';
import { journey, journeyEnding } from './journey.data';

const JourneyTab = () => {
  return (
    <>
      <div className="grid page-head">
        <h1>Learning Journey</h1>
      </div>
      {journey.map((entry) => (
        <article key={entry.id} className="grid chapter">
          <div className="head">
            <div className="date">{entry.date}</div>
            <h2>{entry.title}</h2>
          </div>
          <div
            className="prose"
            dangerouslySetInnerHTML={safeHtml(entry.description)}
          />
          <aside className="side">
            {entry.images.length > 0 && (
              <PrintStack images={entry.images} caption={entry.title} />
            )}
            {entry.videos.length > 0 && <Reel videos={entry.videos} />}
          </aside>
        </article>
      ))}
      <Ending ending={journeyEnding} />
    </>
  );
};

export default JourneyTab;
