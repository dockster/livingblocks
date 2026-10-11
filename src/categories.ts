// The groups a library shows Blocks in. A Block names one by its id; a new
// group is added here, by review.

export interface Category {
  id: string;
  label: string;
}

export const CATEGORIES: Category[] = [
  { id: 'content', label: 'Content' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'feedback', label: 'Feedback' },
];
