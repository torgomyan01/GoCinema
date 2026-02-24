'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Clock,
  Film,
  Plus,
  Edit,
  Trash2,
  X,
  MapPin,
  DollarSign,
  Users,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Star,
  Search,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import AdminLayout from './admin-layout';
import {
  getScreenings,
  getMovies,
  createScreening,
  updateScreening,
  deleteScreening,
} from '@/app/actions/screenings';

interface AdminScreeningsClientProps {
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
  duration: number;
  image?: string | null;
  genre?: string;
  rating?: number;
  description?: string | null;
}

interface Screening {
  id: number;
  movieId: number;
  hallId: number;
  startTime: Date | string;
  endTime: Date | string;
  basePrice: number;
  movie?: {
    id: number;
    title: string;
    image?: string | null;
    duration: number;
  };
  hall?: {
    id: number;
    name: string;
    capacity: number;
  };
  tickets?: Array<{
    id: number;
    status: string;
  }>;
}

export default function AdminScreeningsClient({
  user,
}: AdminScreeningsClientProps) {
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMovieSelectModalOpen, setIsMovieSelectModalOpen] = useState(false);
  const [isTimeSelectModalOpen, setIsTimeSelectModalOpen] = useState(false);
  const [isDayDetailsModalOpen, setIsDayDetailsModalOpen] = useState(false);
  const [selectedDayForDetails, setSelectedDayForDetails] =
    useState<Date | null>(null);
  const [editingScreening, setEditingScreening] = useState<Screening | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    movieId: '',
    hallId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    basePrice: '2000',
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [screeningsResult, moviesResult] = await Promise.all([
          getScreenings(),
          getMovies(),
        ]);

        if (screeningsResult.success) {
          setScreenings(screeningsResult.screenings || []);
        }
        if (moviesResult.success) {
          setMovies(moviesResult.movies || []);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Տվյալները բեռնելիս սխալ է տեղի ունեցել');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Reload screenings when time modal opens to get fresh data
  useEffect(() => {
    if (isTimeSelectModalOpen && formData.date && formData.movieId) {
      const reloadScreenings = async () => {
        const result = await getScreenings();
        if (result.success) {
          setScreenings(result.screenings || []);
        }
      };
      reloadScreenings();
    }
  }, [isTimeSelectModalOpen, formData.date, formData.movieId]);

  // Filter screenings by selected date
  const filteredScreenings = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split('T')[0];
    return screenings.filter((screening) => {
      const screeningDate = new Date(screening.startTime)
        .toISOString()
        .split('T')[0];
      return screeningDate === dateStr;
    });
  }, [screenings, selectedDate]);

  // Calculate end time based on movie duration
  const calculateEndTime = useCallback(
    (startTime: string, movieId: string): string => {
      if (!startTime || !movieId) return '';
      const movie = movies.find((m) => m.id === parseInt(movieId));
      if (!movie) return '';

      const [hours, minutes] = startTime.split(':').map(Number);
      const start = new Date();
      start.setHours(hours, minutes, 0, 0);
      start.setMinutes(start.getMinutes() + movie.duration);

      return `${String(start.getHours()).padStart(2, '0')}:${String(
        start.getMinutes()
      ).padStart(2, '0')}`;
    },
    [movies]
  );

  // Get screenings for the selected date in the form (for time slot visualization)
  const formDateScreenings = useMemo(() => {
    if (!formData.date) return [];
    return screenings.filter((screening) => {
      const screeningDate = new Date(screening.startTime)
        .toISOString()
        .split('T')[0];
      // Exclude the current editing screening to allow editing
      return (
        screeningDate === formData.date && screening.id !== editingScreening?.id
      );
    });
  }, [screenings, formData.date, editingScreening]);

  // Check if a time slot is available
  const isTimeSlotAvailable = useCallback(
    (startTime: string, endTime: string): boolean => {
      if (!startTime || !endTime || !formData.date) return true;

      const start = new Date(`${formData.date}T${startTime}:00`);
      const end = new Date(`${formData.date}T${endTime}:00`);

      return !formDateScreenings.some((screening) => {
        const screeningStart = new Date(screening.startTime);
        const screeningEnd = new Date(screening.endTime);

        // Check for overlap
        return (
          (start >= screeningStart && start < screeningEnd) ||
          (end > screeningStart && end <= screeningEnd) ||
          (start <= screeningStart && end >= screeningEnd)
        );
      });
    },
    [formData.date, formDateScreenings]
  );

  // Get time slots for visualization (with actual movie duration)
  const timeSlots = useMemo(() => {
    const slots: Array<{ time: string; available: boolean; movie?: string }> =
      [];
    const startHour = 9; // 9:00 AM
    const endHour = 23; // 11:00 PM

    if (!formData.date || !formData.movieId) return slots;

    const selectedMovie = movies.find(
      (m) => m.id === parseInt(formData.movieId)
    );
    if (!selectedMovie) return slots;

    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const endTime = calculateEndTime(time, formData.movieId);

        if (!endTime) continue;

        const timeDate = new Date(`${formData.date}T${time}:00`);
        const endTimeDate = new Date(`${formData.date}T${endTime}:00`);

        const available = isTimeSlotAvailable(time, endTime);
        const conflictingScreening = formDateScreenings.find((s) => {
          const sStart = new Date(s.startTime);
          const sEnd = new Date(s.endTime);
          return (
            (timeDate >= sStart && timeDate < sEnd) ||
            (endTimeDate > sStart && endTimeDate <= sEnd) ||
            (timeDate <= sStart && endTimeDate >= sEnd)
          );
        });

        slots.push({
          time,
          available,
          movie: conflictingScreening?.movie?.title,
        });
      }
    }

    return slots;
  }, [
    formData.date,
    formData.movieId,
    formDateScreenings,
    movies,
    calculateEndTime,
    isTimeSlotAvailable,
  ]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setFormData({
      ...formData,
      date: date.toISOString().split('T')[0],
    });
  };

  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    setSelectedDate(date);
    setFormData({
      movieId: '',
      hallId: '',
      date: dateStr,
      startTime: '',
      endTime: '',
      basePrice: '2000',
    });
    setIsModalOpen(true);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const days: Date[] = [];
    const currentDate = new Date(startDate);

    // Generate 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  }, [currentMonth]);

  // Group screenings by date
  const screeningsByDate = useMemo(() => {
    const grouped = new Map<string, Screening[]>();
    screenings.forEach((screening) => {
      const date = new Date(screening.startTime);
      const dateKey = date.toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(screening);
    });
    return grouped;
  }, [screenings]);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return (
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    );
  };

  // Helper functions for consistent date formatting (to avoid hydration errors)
  const formatMonthYear = (date: Date): string => {
    const months = [
      'հունվար',
      'փետրվար',
      'մարտ',
      'ապրիլ',
      'մայիս',
      'հունիս',
      'հուլիս',
      'օգոստոս',
      'սեպտեմբեր',
      'հոկտեմբեր',
      'նոյեմբեր',
      'դեկտեմբեր',
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatDateWithWeekday = (date: Date): string => {
    const weekdays = [
      'կիրակի',
      'երկուշաբթի',
      'երեքշաբթի',
      'չորեքշաբթի',
      'հինգշաբթի',
      'ուրբաթ',
      'շաբաթ',
    ];
    const months = [
      'հունվար',
      'փետրվար',
      'մարտ',
      'ապրիլ',
      'մայիս',
      'հունիս',
      'հուլիս',
      'օգոստոս',
      'սեպտեմբեր',
      'հոկտեմբեր',
      'նոյեմբեր',
      'դեկտեմբեր',
    ];
    return `${weekdays[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatDateDisplay = (date: Date): string => {
    const months = [
      'հունվար',
      'փետրվար',
      'մարտ',
      'ապրիլ',
      'մայիս',
      'հունիս',
      'հուլիս',
      'օգոստոս',
      'սեպտեմբեր',
      'հոկտեմբեր',
      'նոյեմբեր',
      'դեկտեմբեր',
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleAddScreening = () => {
    setEditingScreening(null);
    setError(null);
    const dateStr = selectedDate.toISOString().split('T')[0];
    setFormData({
      movieId: '',
      hallId: '', // Will be auto-set on server
      date: dateStr,
      startTime: '',
      endTime: '',
      basePrice: '2000',
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingScreening(null);
    setError(null);
    setMovieSearchQuery('');
    setFormData({
      movieId: '',
      hallId: '',
      date: selectedDate.toISOString().split('T')[0],
      startTime: '',
      endTime: '',
      basePrice: '2000',
    });
  };

  const handleEditScreening = (screening: Screening) => {
    setEditingScreening(screening);
    setError(null);
    setMovieSearchQuery('');
    const startDate = new Date(screening.startTime);
    const dateStr = startDate.toISOString().split('T')[0];
    setSelectedDate(startDate);
    setFormData({
      movieId: screening.movieId.toString(),
      hallId: '', // Will be auto-set on server
      date: dateStr,
      startTime: startDate.toTimeString().slice(0, 5),
      endTime: new Date(screening.endTime).toTimeString().slice(0, 5),
      basePrice: screening.basePrice.toString(),
    });
    setIsModalOpen(true);
  };

  const handleDeleteScreening = async (id: number) => {
    if (
      !confirm('Դուք համոզված եք, որ ցանկանում եք ջնջել այս ցուցադրությունը?')
    ) {
      return;
    }

    try {
      const result = await deleteScreening(id);
      if (result.success) {
        setScreenings(screenings.filter((s) => s.id !== id));
      } else {
        alert(result.error || 'Ցուցադրությունը ջնջելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error deleting screening:', err);
      alert('Ցուցադրությունը ջնջելիս սխալ է տեղի ունեցել');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.date) {
        setError('Խնդրում ենք ընտրել ամսաթիվ');
        setIsLoading(false);
        return;
      }

      if (!formData.startTime || !formData.endTime) {
        setError('Խնդրում ենք ընտրել ժամանակահատված');
        setIsLoading(false);
        return;
      }

      if (!formData.movieId) {
        setError('Խնդրում ենք ընտրել ֆիլմ');
        setIsLoading(false);
        return;
      }

      // Create date objects with the selected date (ensure correct timezone handling)
      const dateStr = formData.date; // YYYY-MM-DD format
      const startDateTime = new Date(`${dateStr}T${formData.startTime}:00`);
      const endDateTime = new Date(`${dateStr}T${formData.endTime}:00`);

      // Validate dates are valid
      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        setError('Անվավեր ամսաթիվ կամ ժամ');
        setIsLoading(false);
        return;
      }

      // Validate end time is after start time
      if (endDateTime <= startDateTime) {
        setError('Ավարտի ժամը պետք է լինի ավելի ուշ, քան սկզբի ժամը');
        setIsLoading(false);
        return;
      }

      const data = {
        movieId: parseInt(formData.movieId),
        // hallId will be auto-set on server (we have only one hall)
        startTime: startDateTime,
        endTime: endDateTime,
        basePrice: parseFloat(formData.basePrice),
      };

      let result;
      if (editingScreening) {
        result = await updateScreening({
          id: editingScreening.id,
          ...data,
        });
      } else {
        result = await createScreening(data);
      }

      if (result.success && result.screening) {
        // Reload screenings to get fresh data
        const screeningsResult = await getScreenings();
        if (screeningsResult.success) {
          setScreenings(screeningsResult.screenings || []);
        }
        setIsModalOpen(false);
        resetForm();
      } else {
        setError(
          result.error || 'Ցուցադրությունը պահպանելիս սխալ է տեղի ունեցել'
        );
      }
    } catch (err) {
      console.error('Error saving screening:', err);
      setError('Ցուցադրությունը պահպանելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('hy-AM', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAvailableSeats = (screening: Screening) => {
    const totalSeats = screening.hall?.capacity || 0;
    const bookedSeats =
      screening.tickets?.filter(
        (t) => t.status === 'paid' || t.status === 'reserved'
      ).length || 0;
    return totalSeats - bookedSeats;
  };

  const handleMovieSelect = (movie: Movie) => {
    setFormData({
      ...formData,
      movieId: movie.id.toString(),
      endTime: formData.startTime
        ? calculateEndTime(formData.startTime, movie.id.toString())
        : '',
    });
    setIsMovieSelectModalOpen(false);
    setMovieSearchQuery('');
  };

  const filteredMovies = useMemo(() => {
    if (!movieSearchQuery) return movies;
    const query = movieSearchQuery.toLowerCase();
    return movies.filter(
      (movie) =>
        movie.title.toLowerCase().includes(query) ||
        movie.genre?.toLowerCase().includes(query)
    );
  }, [movies, movieSearchQuery]);

  const selectedMovie = useMemo(() => {
    return movies.find((m) => m.id === parseInt(formData.movieId));
  }, [movies, formData.movieId]);

  return (
    <AdminLayout user={user}>
      <div className="flex-1 overflow-y-auto bg-gray-50">
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
                <h1 className="text-2xl font-bold text-gray-900">
                  Ցուցադրություններ
                </h1>
                <p className="text-sm text-gray-600">
                  Կառավարել ֆիլմերի ցուցադրությունները
                </p>
              </div>
            </div>
            <button
              onClick={handleAddScreening}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Ավելացնել ցուցադրություն
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Large Calendar */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Calendar Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {formatMonthYear(currentMonth)}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Ընտրեք օր ցուցադրություն ավելացնելու համար
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <button
                        onClick={() => setCurrentMonth(new Date())}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Այսօր
                      </button>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="p-6">
                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {['Կիր', 'Երկ', 'Երք', 'Չոր', 'Հնգ', 'Ուրբ', 'Շաբ'].map(
                      (day) => (
                        <div
                          key={day}
                          className="text-center text-sm font-semibold text-gray-600 py-2"
                        >
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((date, index) => {
                      const dateKey = date.toISOString().split('T')[0];
                      const dayScreenings = screeningsByDate.get(dateKey) || [];
                      const isCurrentMonthDay = isCurrentMonth(date);
                      const isSelectedDay = isSelected(date);
                      const isTodayDay = isToday(date);

                      return (
                        <div
                          key={index}
                          className={`
                            min-h-[120px] border border-gray-200 rounded-lg p-2
                            transition-all hover:shadow-md relative group
                            ${
                              !isCurrentMonthDay
                                ? 'bg-gray-50 opacity-40'
                                : 'bg-white hover:border-blue-300 cursor-pointer'
                            }
                            ${
                              isSelectedDay
                                ? 'border-blue-500 border-2 bg-blue-50'
                                : ''
                            }
                            ${isTodayDay ? 'ring-2 ring-blue-400' : ''}
                          `}
                        >
                          {/* Day Header */}
                          <div className="flex items-center justify-between mb-1">
                            <div
                              className={`
                                text-sm font-medium
                                ${isTodayDay ? 'text-blue-600' : 'text-gray-700'}
                                ${!isCurrentMonthDay ? 'text-gray-400' : ''}
                              `}
                            >
                              {date.getDate()}
                            </div>
                            {isCurrentMonthDay && dayScreenings.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDayForDetails(date);
                                  setIsDayDetailsModalOpen(true);
                                }}
                                className="p-1 hover:bg-blue-100 rounded transition-colors"
                                title="Դիտել մանրամասներ"
                              >
                                <Info className="w-3.5 h-3.5 text-blue-600" />
                              </button>
                            )}
                          </div>

                          {/* Day Click Handler */}
                          <div
                            onClick={() => {
                              if (isCurrentMonthDay) {
                                handleDayClick(date);
                              }
                            }}
                            className="flex-1 min-h-[60px] cursor-pointer"
                          >
                            {dayScreenings.length > 0 ? (
                              <div className="space-y-1">
                                {dayScreenings.slice(0, 3).map((screening) => (
                                  <div
                                    key={screening.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditScreening(screening);
                                    }}
                                    className="text-xs bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 truncate hover:bg-blue-200 transition-colors cursor-pointer"
                                    title={`${screening.movie?.title || 'Անհայտ'} - ${formatTime(screening.startTime)}`}
                                  >
                                    {formatTime(screening.startTime)}{' '}
                                    {screening.movie?.title?.slice(0, 10) ||
                                      'Անհայտ'}
                                    {screening.movie?.title &&
                                    screening.movie.title.length > 10
                                      ? '...'
                                      : ''}
                                  </div>
                                ))}
                                {dayScreenings.length > 3 && (
                                  <div
                                    className="text-xs text-gray-500 font-medium cursor-pointer hover:text-gray-700"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDayForDetails(date);
                                      setIsDayDetailsModalOpen(true);
                                    }}
                                  >
                                    +{dayScreenings.length - 3} ավելին
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus className="w-4 h-4 mr-1" />
                                Ավելացնել
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Screenings List */}
              <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {formatDateWithWeekday(selectedDate)}
                </h3>

                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Բեռնվում է...</p>
                  </div>
                ) : filteredScreenings.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg mb-2">
                      Այս օրը ցուցադրություններ չկան
                    </p>
                    <button
                      onClick={handleAddScreening}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Ավելացնել ցուցադրություն
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredScreenings.map((screening) => (
                      <motion.div
                        key={screening.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Film className="w-5 h-5 text-blue-600" />
                              <h4 className="font-bold text-gray-900">
                                {screening.movie?.title || 'Անհայտ ֆիլմ'}
                              </h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {formatTime(screening.startTime)} -{' '}
                                  {formatTime(screening.endTime)}
                                </span>
                              </div>
                              {/* Hall info removed - we have only one hall */}
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                <span>{screening.basePrice} ֏</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                <span>
                                  {getAvailableSeats(screening)} /{' '}
                                  {screening.hall?.capacity || 0} տեղ
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditScreening(screening)}
                              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteScreening(screening.id)
                              }
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Info Panel */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Ցուցադրությունների վիճակագրություն
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">
                      Ընտրված օրվա ցուցադրություններ
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {filteredScreenings.length}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">
                      Ընդհանուր ցուցադրություններ
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {screenings.length}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">
                      Հասանելի ֆիլմեր
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {movies.length}
                    </p>
                  </div>
                  {/* We have only one hall, so don't show hall count */}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
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
                    {editingScreening
                      ? 'Խմբագրել ցուցադրություն'
                      : 'Ավելացնել նոր ցուցադրություն'}
                  </h2>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingScreening(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ֆիլմ <span className="text-red-500">*</span>
                    </label>
                    {selectedMovie ? (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        {selectedMovie.image && (
                          <div className="relative w-16 h-24 rounded overflow-hidden flex-shrink-0">
                            <Image
                              src={selectedMovie.image}
                              alt={selectedMovie.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {selectedMovie.title}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Clock className="w-4 h-4" />
                            <span>{selectedMovie.duration} ր</span>
                            {selectedMovie.genre && (
                              <>
                                <span>•</span>
                                <span>{selectedMovie.genre}</span>
                              </>
                            )}
                            {selectedMovie.rating && (
                              <>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                  <span>{selectedMovie.rating}/10</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMovieSelectModalOpen(true)}
                          className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Փոխել
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsMovieSelectModalOpen(true)}
                        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Film className="w-5 h-5" />
                        Ընտրել ֆիլմ
                      </button>
                    )}
                  </div>

                  {/* Hall is auto-selected on server (we have only one hall) */}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ամսաթիվ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setFormData({
                          ...formData,
                          date: newDate,
                          startTime: '', // Reset time when date changes
                          endTime: '', // Reset time when date changes
                        });
                        setSelectedDate(new Date(newDate));
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ժամանակահատված <span className="text-red-500">*</span>
                    </label>
                    {formData.startTime && formData.endTime ? (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {formData.startTime} - {formData.endTime}
                          </p>
                          {formData.date &&
                            formData.startTime &&
                            formData.endTime &&
                            !isTimeSlotAvailable(
                              formData.startTime,
                              formData.endTime
                            ) &&
                            !editingScreening && (
                              <p className="text-xs text-red-600 mt-1">
                                ⚠️ Այս ժամանակահատվածը արդեն զբաղված է
                              </p>
                            )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsTimeSelectModalOpen(true)}
                          className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          Փոխել
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsTimeSelectModalOpen(true)}
                        disabled={!formData.date || !formData.movieId}
                        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Clock className="w-5 h-5" />
                        Ընտրել ժամանակահատված
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Հիմնական գին (֏) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="100"
                      value={formData.basePrice}
                      onChange={(e) =>
                        setFormData({ ...formData, basePrice: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading
                        ? 'Պահպանվում է...'
                        : editingScreening
                          ? 'Պահպանել'
                          : 'Ավելացնել'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        resetForm();
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

        {/* Time Selection Modal */}
        <AnimatePresence>
          {isTimeSelectModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={async () => {
                // Reload screenings when modal closes to get fresh data
                const freshScreeningsResult = await getScreenings();
                if (freshScreeningsResult.success) {
                  setScreenings(freshScreeningsResult.screenings || []);
                }
                setIsTimeSelectModalOpen(false);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Ընտրել ժամանակահատված
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {formData.date &&
                        formatDateWithWeekday(new Date(formData.date))}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsTimeSelectModalOpen(false);
                      // Reload screenings when modal closes to get fresh data
                      getScreenings().then((result) => {
                        if (result.success) {
                          setScreenings(result.screenings || []);
                        }
                      });
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {!formData.date ? (
                    <div className="text-center py-12">
                      <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        Խնդրում ենք նախ ընտրել ամսաթիվ
                      </p>
                    </div>
                  ) : !formData.movieId ? (
                    <div className="text-center py-12">
                      <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        Խնդրում ենք նախ ընտրել ֆիլմ
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Legend */}
                      <div className="mb-6 flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded"></div>
                          <span className="text-gray-600">Հասանելի</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded"></div>
                          <span className="text-gray-600">Զբաղված</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-blue-500 rounded"></div>
                          <span className="text-gray-600">Ընտրված</span>
                        </div>
                      </div>

                      {/* Time Slots Grid */}
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {timeSlots.map((slot) => {
                          const isSelected =
                            formData.startTime === slot.time ||
                            (formData.startTime &&
                              formData.endTime &&
                              slot.time >= formData.startTime &&
                              slot.time <= formData.endTime);

                          const calculatedEndTime = calculateEndTime(
                            slot.time,
                            formData.movieId
                          );
                          const wouldOverlap =
                            !slot.available &&
                            slot.movie &&
                            calculatedEndTime &&
                            isTimeSlotAvailable(
                              slot.time,
                              calculatedEndTime
                            ) === false;

                          return (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={async () => {
                                if (slot.available && formData.movieId) {
                                  const endTime = calculateEndTime(
                                    slot.time,
                                    formData.movieId
                                  );

                                  // Reload screenings to get fresh data before checking
                                  const freshScreeningsResult =
                                    await getScreenings();
                                  if (freshScreeningsResult.success) {
                                    setScreenings(
                                      freshScreeningsResult.screenings || []
                                    );
                                  }

                                  // Check availability with fresh data
                                  const available = isTimeSlotAvailable(
                                    slot.time,
                                    endTime
                                  );

                                  if (available) {
                                    setFormData({
                                      ...formData,
                                      startTime: slot.time,
                                      endTime: endTime,
                                    });
                                    setIsTimeSelectModalOpen(false);
                                  } else {
                                    setError(
                                      'Այս ժամանակահատվածը արդեն զբաղված է'
                                    );
                                  }
                                }
                              }}
                              disabled={!slot.available}
                              className={`
                                px-3 py-2 text-sm rounded-lg transition-all font-medium
                                ${
                                  !slot.available
                                    ? 'bg-red-100 text-red-700 border-2 border-red-500 cursor-not-allowed opacity-70'
                                    : isSelected
                                      ? 'bg-blue-500 text-white border-2 border-blue-600'
                                      : 'bg-green-50 text-gray-700 border-2 border-green-500 hover:bg-green-100 hover:border-green-600'
                                }
                              `}
                              title={
                                !slot.available
                                  ? `Զբաղված: ${slot.movie || 'Անհայտ'}`
                                  : `${slot.time} - ${calculatedEndTime || '...'}`
                              }
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>

                      {/* Show conflicting screenings */}
                      {formDateScreenings.length > 0 && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3">
                            Այս օրվա ցուցադրություններ:
                          </h3>
                          <div className="space-y-2">
                            {formDateScreenings.map((screening) => (
                              <div
                                key={screening.id}
                                className="flex items-center justify-between text-sm p-2 bg-white rounded border border-gray-200"
                              >
                                <div className="flex items-center gap-2">
                                  <Film className="w-4 h-4 text-red-600" />
                                  <span className="font-medium text-gray-900">
                                    {screening.movie?.title || 'Անհայտ'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    {formatTime(screening.startTime)} -{' '}
                                    {formatTime(screening.endTime)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Movie Selection Modal */}
        <AnimatePresence>
          {isMovieSelectModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setIsMovieSelectModalOpen(false);
                setMovieSearchQuery('');
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Ընտրել ֆիլմ
                  </h2>
                  <button
                    onClick={() => {
                      setIsMovieSelectModalOpen(false);
                      setMovieSearchQuery('');
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* Search */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Փնտրել ֆիլմ..."
                      value={movieSearchQuery}
                      onChange={(e) => setMovieSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Movies Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                  {filteredMovies.length === 0 ? (
                    <div className="text-center py-12">
                      <Film className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 text-lg">
                        {movieSearchQuery ? 'Ֆիլմ չի գտնվել' : 'Ֆիլմեր չկան'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredMovies.map((movie) => (
                        <motion.div
                          key={movie.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => handleMovieSelect(movie)}
                          className={`
                            border-2 rounded-lg p-4 cursor-pointer transition-all
                            ${
                              selectedMovie?.id === movie.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                            }
                          `}
                        >
                          <div className="flex gap-4">
                            {movie.image && (
                              <div className="relative w-20 h-28 rounded overflow-hidden flex-shrink-0">
                                <Image
                                  src={movie.image}
                                  alt={movie.title}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-gray-900 mb-1 truncate">
                                {movie.title}
                              </h3>
                              <div className="space-y-1 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span>{movie.duration} րոպե</span>
                                </div>
                                {movie.genre && (
                                  <div className="flex items-center gap-2">
                                    <Film className="w-4 h-4" />
                                    <span>{movie.genre}</span>
                                  </div>
                                )}
                                {movie.rating && (
                                  <div className="flex items-center gap-2">
                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    <span>{movie.rating}/10</span>
                                  </div>
                                )}
                              </div>
                              {movie.description && (
                                <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                  {movie.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Day Details Modal */}
        <AnimatePresence>
          {isDayDetailsModalOpen && selectedDayForDetails && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => {
                setIsDayDetailsModalOpen(false);
                setSelectedDayForDetails(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              >
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Օրվա ցուցադրություններ
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedDayForDetails &&
                        formatDateWithWeekday(selectedDayForDetails)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsDayDetailsModalOpen(false);
                      setSelectedDayForDetails(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {(() => {
                    const dateKey = selectedDayForDetails
                      .toISOString()
                      .split('T')[0];
                    const dayScreenings = screenings.filter((screening) => {
                      const screeningDate = new Date(screening.startTime)
                        .toISOString()
                        .split('T')[0];
                      return screeningDate === dateKey;
                    });

                    if (dayScreenings.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 text-lg">
                            Այս օրը ցուցադրություններ չկան
                          </p>
                          <button
                            onClick={() => {
                              setIsDayDetailsModalOpen(false);
                              setSelectedDayForDetails(null);
                              handleDayClick(selectedDayForDetails);
                            }}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Ավելացնել ցուցադրություն
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {dayScreenings
                          .sort((a, b) => {
                            const timeA = new Date(a.startTime).getTime();
                            const timeB = new Date(b.startTime).getTime();
                            return timeA - timeB;
                          })
                          .map((screening) => (
                            <motion.div
                              key={screening.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-3">
                                    {screening.movie?.image && (
                                      <div className="relative w-16 h-24 rounded overflow-hidden flex-shrink-0">
                                        <Image
                                          src={screening.movie.image}
                                          alt={
                                            screening.movie.title || 'Անհայտ'
                                          }
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    )}
                                    <div className="flex-1">
                                      <h3 className="font-bold text-lg text-gray-900 mb-1">
                                        {screening.movie?.title ||
                                          'Անհայտ ֆիլմ'}
                                      </h3>
                                      {screening.movie?.genre && (
                                        <span className="inline-block px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                          {screening.movie.genre}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex items-center gap-2 text-gray-600">
                                      <Clock className="w-4 h-4" />
                                      <span>
                                        {formatTime(screening.startTime)} -{' '}
                                        {formatTime(screening.endTime)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600">
                                      <DollarSign className="w-4 h-4" />
                                      <span className="font-semibold">
                                        {screening.basePrice} ֏
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600">
                                      <Users className="w-4 h-4" />
                                      <span>
                                        {getAvailableSeats(screening)} /{' '}
                                        {screening.hall?.capacity || 0} տեղ
                                      </span>
                                    </div>
                                    {screening.movie?.rating && (
                                      <div className="flex items-center gap-2 text-gray-600">
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                        <span>{screening.movie.rating}/10</span>
                                      </div>
                                    )}
                                  </div>

                                  {screening.movie?.description && (
                                    <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                                      {screening.movie.description}
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-col gap-2 ml-4">
                                  <button
                                    onClick={() => {
                                      setIsDayDetailsModalOpen(false);
                                      setSelectedDayForDetails(null);
                                      handleEditScreening(screening);
                                    }}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                    title="Խմբագրել"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (
                                        confirm(
                                          'Դուք համոզված եք, որ ցանկանում եք ջնջել այս ցուցադրությունը?'
                                        )
                                      ) {
                                        handleDeleteScreening(screening.id);
                                        setIsDayDetailsModalOpen(false);
                                        setSelectedDayForDetails(null);
                                      }
                                    }}
                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                    title="Ջնջել"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
