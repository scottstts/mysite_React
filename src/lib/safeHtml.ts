import DOMPurify from 'dompurify';

export const safeHtml = (html: string): { __html: string } => ({
  __html: DOMPurify.sanitize(html),
});
