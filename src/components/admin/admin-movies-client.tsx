'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film,
  Plus,
  Edit,
  Trash2,
  X,
  Calendar,
  Clock,
  Star,
  Image as ImageIcon,
  Search,
  ArrowLeft,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Autocomplete, AutocompleteItem } from '@heroui/react';
import AdminLayout from './admin-layout';
import FileUpload from './file-upload';
import {
  getMovies,
  createMovie,
  updateMovie,
  deleteMovie,
} from '@/app/actions/movies';

interface AdminMoviesClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface Movie {
  id: number;
  title: string;
  slug?: string;
  image?: string | null;
  duration: number;
  rating: number;
  genre: string;
  releaseDate: Date | string;
  description?: string;
  trailerUrl?: string | null;
  isActive?: boolean;
}

export default function AdminMoviesClient({ user }: AdminMoviesClientProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Available genres
  const genres = [
    'Ֆանտաստիկա',
    'Դրամա',
    'Կատակերգություն',
    'Մարտաֆիլմ',
    'Թրիլեր',
    'Սարսափ',
    'Ռոմանտիկ',
    'Արկածային',
    'Պատմական',
    'Գիտական',
    'Անիմացիա',
    'Վավերագրական',
    'Մյուզիքլ',
    'Արևմտյան',
    'Քրեական',
  ];

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    image: '',
    duration: '',
    rating: '',
    genre: '',
    releaseDate: '',
    description: '',
    trailerUrl: '',
  });

  // Load movies from database
  useEffect(() => {
    const loadMovies = async () => {
      setIsLoading(true);
      try {
        const result = await getMovies();
        if (result.success && result.movies) {
          setMovies(result.movies);
        } else {
          console.error('Failed to load movies:', result.error);
        }
      } catch (error) {
        console.error('Error loading movies:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMovies();
  }, []);

  const filteredMovies = movies.filter((movie) =>
    movie.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMovie = () => {
    setFormData({
      title: '',
      slug: '',
      image: '',
      duration: '',
      rating: '',
      genre: '',
      releaseDate: '',
      description: '',
      trailerUrl: '',
    });
    setIsAddModalOpen(true);
  };

  const handleEditMovie = (movie: Movie) => {
    setSelectedMovie(movie);
    setFormData({
      title: movie.title,
      slug: movie.slug || '',
      image: movie.image || '',
      duration: movie.duration.toString(),
      rating: movie.rating.toString(),
      genre: movie.genre,
      releaseDate: new Date(movie.releaseDate).toISOString().split('T')[0],
      description: movie.description || '',
      trailerUrl: movie.trailerUrl || '',
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteMovie = async (id: number) => {
    if (confirm('Դուք համոզված եք, որ ցանկանում եք ջնջել այս ֆիլմը?')) {
      try {
        const result = await deleteMovie(id);
        if (result.success) {
          setMovies(movies.filter((m) => m.id !== id));
        } else {
          alert(result.error || 'Ֆիլմը ջնջելիս սխալ է տեղի ունեցել');
        }
      } catch (error) {
        console.error('Error deleting movie:', error);
        alert('Ֆիլմը ջնջելիս սխալ է տեղի ունեցել');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isAddModalOpen) {
        const result = await createMovie({
          title: formData.title,
          slug: formData.slug || undefined,
          image: formData.image || null,
          duration: parseInt(formData.duration),
          rating: parseFloat(formData.rating),
          genre: formData.genre,
          releaseDate: new Date(formData.releaseDate),
          description: formData.description || null,
          trailerUrl: formData.trailerUrl || null,
          isActive: true,
        });

        if (result.success && result.movie) {
          setMovies([...movies, result.movie as Movie]);
          setIsAddModalOpen(false);
        } else {
          alert(result.error || 'Ֆիլմ ավելացնելիս սխալ է տեղի ունեցել');
        }
      } else if (isEditModalOpen && selectedMovie) {
        const result = await updateMovie({
          id: selectedMovie.id,
          title: formData.title,
          slug: formData.slug || undefined,
          image: formData.image || null,
          duration: parseInt(formData.duration),
          rating: parseFloat(formData.rating),
          genre: formData.genre,
          releaseDate: new Date(formData.releaseDate),
          description: formData.description || null,
          trailerUrl: formData.trailerUrl || null,
        });

        if (result.success && result.movie) {
          setMovies(
            movies.map((m) =>
              m.id === selectedMovie.id ? (result.movie as Movie) : m
            )
          );
          setIsEditModalOpen(false);
          setSelectedMovie(null);
        } else {
          alert(result.error || 'Ֆիլմ թարմացնելիս սխալ է տեղի ունեցել');
        }
      }
    } catch (error) {
      console.error('Error saving movie:', error);
      alert('Ֆիլմ պահպանելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);

      // Reset form
      setFormData({
        title: '',
        slug: '',
        image: '',
        duration: '',
        rating: '',
        genre: '',
        releaseDate: '',
        description: '',
        trailerUrl: '',
      });
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('hy-AM', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}ժ ${mins}ր`;
  };

  return (
    <AdminLayout user={user}>
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Ֆիլմեր</h1>
                <p className="text-sm text-gray-600">Կառավարել ֆիլմերը</p>
              </div>
            </div>
            <button
              onClick={handleAddMovie}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Ավելացնել ֆիլմ
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Փնտրել ֆիլմ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Movies Grid */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Բեռնվում է...</p>
            </div>
          ) : filteredMovies.length === 0 ? (
            <div className="text-center py-12">
              <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-2">
                {searchQuery ? 'Ֆիլմ չի գտնվել' : 'Ֆիլմեր չկան'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleAddMovie}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Ավելացնել առաջին ֆիլմը
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMovies.map((movie, index) => (
                <motion.div
                  key={movie.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {/* Movie Image */}
                  <div className="relative w-full h-64 bg-gray-200">
                    <Image
                      src={
                        movie.image ||
                        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800'
                      }
                      alt={movie.title}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Movie Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {movie.title}
                    </h3>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(movie.releaseDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(movie.duration)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{movie.rating}/10</span>
                      </div>
                      <div className="text-sm">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                          {movie.genre}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                      {movie.trailerUrl && (
                        <a
                          href={movie.trailerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full px-3 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Դիտել Trailer
                        </a>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditMovie(movie)}
                          className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Խմբագրել
                        </button>
                        <button
                          onClick={() => handleDeleteMovie(movie.id)}
                          className="px-3 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {(isAddModalOpen || isEditModalOpen) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
                setSelectedMovie(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    {isAddModalOpen ? 'Ավելացնել նոր ֆիլմ' : 'Խմբագրել ֆիլմ'}
                  </h2>
                  <button
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setIsEditModalOpen(false);
                      setSelectedMovie(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Անվանում <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Ֆիլմի անվանում"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Slug
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({ ...formData, slug: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="auto-generated"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Տևողություն (րոպե){' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.duration}
                        onChange={(e) =>
                          setFormData({ ...formData, duration: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Վարկանիշ (0-10) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="10"
                        step="0.1"
                        value={formData.rating}
                        onChange={(e) =>
                          setFormData({ ...formData, rating: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ժանր <span className="text-red-500">*</span>
                      </label>
                      <Autocomplete
                        placeholder="Ընտրեք կամ մուտքագրեք ժանր"
                        selectedKey={formData.genre || null}
                        onSelectionChange={(key) =>
                          setFormData({
                            ...formData,
                            genre: key ? (key as string) : '',
                          })
                        }
                        allowsCustomValue
                        defaultItems={genres.map((genre) => ({
                          key: genre,
                          label: genre,
                        }))}
                        classNames={{
                          base: 'w-full',
                        }}
                        startContent={
                          <Film className="w-4 h-4 text-gray-400" />
                        }
                        isRequired
                        inputValue={formData.genre}
                        onInputChange={(value) =>
                          setFormData({ ...formData, genre: value })
                        }
                      >
                        {(genre) => (
                          <AutocompleteItem
                            key={genre.key}
                            textValue={genre.label}
                          >
                            {genre.label}
                          </AutocompleteItem>
                        )}
                      </Autocomplete>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Թողարկման ամսաթիվ{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.releaseDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            releaseDate: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <FileUpload
                    value={formData.image}
                    onChange={(url) => setFormData({ ...formData, image: url })}
                    label="Նկար"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      YouTube Trailer URL
                    </label>
                    <input
                      type="url"
                      value={formData.trailerUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, trailerUrl: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Մուտքագրեք YouTube trailer-ի հղումը
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Նկարագրություն
                    </label>
                    <textarea
                      rows={4}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Ֆիլմի նկարագրություն"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
                    >
                      {isAddModalOpen ? 'Ավելացնել' : 'Պահպանել'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setIsEditModalOpen(false);
                        setSelectedMovie(null);
                      }}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      Չեղարկել
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
