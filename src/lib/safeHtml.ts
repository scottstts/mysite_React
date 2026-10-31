import DOMPurify from 'dompurify';
import { inlineIcons } from './icons';

export const safeHtml = (html: string): { __html: string } => ({
  __html: DOMPurify.sanitize(inlineIcons(html)),
});
