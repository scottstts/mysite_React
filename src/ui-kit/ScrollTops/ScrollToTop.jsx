import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import styles from './ScrollToTop.module.css';

const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  // ... existing code ...
    };
  }, []);

  return (
    <button
      id="scroll-top-button"
      className={clsx(styles['scroll-top-button'], !isVisible && styles.hidden)}
      onClick={scrollToTop}
      aria-label="Scroll to top"
    >
// ... existing code ...

</rewritten_file> 