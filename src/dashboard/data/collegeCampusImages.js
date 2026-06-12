const mediaBase = import.meta.env.BASE_URL;

/** Verified remote campus scenes used only if a local asset fails to load. */
const REMOTE_CAMPUS_PHOTOS = [
  "https://images.unsplash.com/photo-1562774053-701939374585?w=960&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=960&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=960&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=960&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=960&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1564981797816-1043664bf78d?w=960&h=600&fit=crop&q=80"
];

export function getCollegeCampusFallback(rank = 1) {
  return REMOTE_CAMPUS_PHOTOS[(rank - 1) % REMOTE_CAMPUS_PHOTOS.length];
}

export function getCollegeCampusImage(id) {
  return `${mediaBase}media/campuses/${id}.jpg`;
}
