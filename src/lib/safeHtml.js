import DOMPurify from 'dompurify';

export const safeHtml = (html) => ({
  __html: DOMPurify.sanitize(html),
});
