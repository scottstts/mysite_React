import type { CSSProperties } from 'react';
import { Helmet } from 'react-helmet-async';
import { imageRatio, imageUrl } from '@/lib/images';
import Ending from '@/ui-kit/Ending/Ending';
import Paragraphs from '@/ui-kit/Paragraphs/Paragraphs';
import { useLift } from '@/ui-kit/Lift/liftContext';
import { inspirations, inspirationsEnding } from './inspirations.data';

// each portrait is pinned at its own small angle
const TILT = [-1.4, 1, -0.6, 1.3, -1, 0.8];

const InspirationsTab = () => {
  const { lift } = useLift();

  return (
    <>
      <Helmet>
        <title>Inspirations - Scott Sun</title>
        <meta
          name="description"
          content="Scott Sun's inspirations - people who inspire and motivate through their brilliance and hard work in AI and technology."
        />
      </Helmet>
      <div className="grid page-head">
        <h1>My Inspirations</h1>
      </div>
      {inspirations.map((person, index) => (
        <article key={person.id} className="grid person">
          <div className="photo">
            <button
              className="print"
              aria-label={`Open portrait of ${person.name}`}
              style={
                { '--rot': `${TILT[index % TILT.length]}deg` } as CSSProperties
              }
              onClick={(event) =>
                lift({
                  items: [
                    {
                      src: imageUrl(person.image),
                      ratio: imageRatio(person.image),
                    },
                  ],
                  index: 0,
                  from: event.currentTarget,
                  caption: person.name,
                })
              }
            >
              <img
                src={imageUrl(person.image)}
                alt={person.name}
                loading="lazy"
                style={{ aspectRatio: imageRatio(person.image) }}
              />
            </button>
          </div>
          <div className="copy">
            <h2>{person.name}</h2>
            <Paragraphs html={person.description} />
          </div>
        </article>
      ))}
      <Ending ending={inspirationsEnding} />
    </>
  );
};

export default InspirationsTab;
