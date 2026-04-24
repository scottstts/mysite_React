import React, { Suspense, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { artInLifeUrls } from './artInLife.data';
import styles from './ArtInLifeTab.module.css';

const ArtInLifeGallery = React.lazy(() => import('./ArtInLifeGallery'));

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];

  for (let index = newArray.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [newArray[index], newArray[randomIndex]] = [
      newArray[randomIndex],
      newArray[index],
    ];
  }

  return newArray;
};

const ArtInLifeTab = () => {
  const galleryUrls = useMemo(() => shuffleArray(artInLifeUrls), []);

  return (
    <>
      <Helmet>
        <title>Art in Life - Scott Sun</title>
        <meta
          name="description"
          content="A collection of natural scenery photos presented as a quiet gallery walk."
        />
      </Helmet>

      <section className={styles.galleryPage} aria-label="Art in Life gallery">
        <Suspense
          fallback={
            <div className={styles.sceneFallback} role="status">
              <span className={styles.loadingMark} aria-hidden="true" />
              <span>Preparing gallery</span>
            </div>
          }
        >
          <ArtInLifeGallery urls={galleryUrls} />
        </Suspense>
      </section>
    </>
  );
};

export default ArtInLifeTab;
