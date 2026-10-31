import { imageRatio, imageUrl } from '@/lib/images';
import { safeHtml } from '@/lib/safeHtml';
import { useLift } from '@/ui-kit/Lift/liftContext';
import type { PageEnding } from '@/types/content';

// The ending of a page: a short rule, the closing line, and an optional print.
const Ending = ({ ending }: { ending: PageEnding }) => {
  const { lift } = useLift();
  const { image } = ending;

  return (
    <section className="epilogue">
      <div className="inner">
        <span className="mark-end" />
        <p dangerouslySetInnerHTML={safeHtml(ending.text)} />
        {image && (
          <button
            className="note"
            aria-label="Open image"
            onClick={(event) =>
              lift({
                items: [{ src: imageUrl(image), ratio: imageRatio(image) }],
                index: 0,
                from: event.currentTarget,
              })
            }
          >
            <img src={imageUrl(image)} alt="" loading="lazy" />
          </button>
        )}
      </div>
    </section>
  );
};

export default Ending;
