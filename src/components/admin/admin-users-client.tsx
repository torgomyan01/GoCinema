'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit,
  Trash2,
  X,
  Save,
  Users,
  Search,
  Filter,
  Phone,
  Mail,
  Calendar,
  Shield,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  Ban,
  ShieldCheck,
  UserX,
  Clock,
  Ticket,
  Gift,
  ShoppingBag,
  Star,
  RotateCcw,
} from 'lucide-react';
import {
  getAllUsers,
  getUserById,
  getUserDetails,
  updateUser,
  changeUserPassword,
  deleteUser,
  setUserBlocked,
  getNoShowReport,
} from '@/app/actions/users';
import {
  ALL_ROLES,
  ROLE_LABELS,
  parseRoles,
  serializeRoles,
} from '@/lib/roles';
import {
  BONUS_TIERS,
  TIER_LABELS_HY,
  BONUS_TYPE_LABELS_HY,
  formatPoints,
} from '@/lib/bonus-labels';
import {
  formatPrice,
  formatDateHy,
  formatDateTimeHy,
  formatTimeHy,
} from '@/lib/format';

const roleBadgeStyles: Record<string, string> = {
  user: 'bg-gray-100 text-gray-800',
  admin: 'bg-purple-100 text-purple-800',
  moderator: 'bg-blue-100 text-blue-800',
  employee: 'bg-emerald-100 text-emerald-800',
  producer: 'bg-amber-100 text-amber-800',
};

const tierBadgeStyles: Record<string, string> = {
  silver: 'bg-slate-100 text-slate-700',
  gold: 'bg-amber-100 text-amber-800',
  platinum: 'bg-violet-100 text-violet-800',
};

const ticketStatusLabels: Record<string, string> = {
  reserved: 'Ամրագրված',
  awaiting_payment: 'Սպասում է վճարման',
  paid: 'Վճարված',
  used: 'Օգտագործված',
  cancelled: 'Չեղարկված',
};

const orderStatusLabels: Record<string, string> = {
  pending: 'Սպասում',
  completed: 'Ավարտված',
  failed: 'Ձախողված',
  cancelled: 'Չեղարկված',
};

interface AdminUsersClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface UserType {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  isBlocked: boolean;
  blockedAt?: Date | string | null;
  birthDate?: Date | string | null;
  bonusPoints: number;
  bonusTier: string;
  bonusVisits: number;
  referralCode?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  _count: {
    tickets: number;
    orders: number;
    payments?: number;
    referrals?: number;
  };
}

interface NoShowUser {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  isBlocked: boolean;
  blockedAt?: Date | string | null;
  noShowCount: number;
  lastNoShowAt?: Date | string | null;
}

type UserDetailsPayload = NonNullable<
  Awaited<ReturnType<typeof getUserDetails>>['details']
>;

type BlockedFilter = 'all' | 'blocked' | 'active';
type VerifiedFilter = 'all' | 'verified' | 'unverified';
type SortBy = 'newest' | 'tickets' | 'bonus' | 'name';

export default function AdminUsersClient({
  user: currentUser,
}: AdminUsersClientProps) {
  const [users, setUsers] = useState<UserType[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserType[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetailsPayload | null>(
    null
  );
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [blockedFilter, setBlockedFilter] = useState<BlockedFilter>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [verifiedFilter, setVerifiedFilter] =
    useState<VerifiedFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'noshow'>('all');
  const [noShowUsers, setNoShowUsers] = useState<NoShowUser[]>([]);
  const [isLoadingNoShow, setIsLoadingNoShow] = useState(false);
  const [blockingId, setBlockingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    roles: ['user'] as string[],
    phoneVerified: false,
    emailVerified: false,
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (viewMode === 'noshow') {
      loadNoShow();
    }
  }, [viewMode]);

  const loadNoShow = async () => {
    setIsLoadingNoShow(true);
    try {
      const result = await getNoShowReport();
      if (result.success && result.users) {
        setNoShowUsers(result.users as NoShowUser[]);
      }
    } catch (err) {
      console.error('Error loading no-show report:', err);
    } finally {
      setIsLoadingNoShow(false);
    }
  };

  const handleToggleBlock = async (userId: number, block: boolean) => {
    if (block) {
      if (
        !confirm(
          'Արգելափակե՞լ այս օգտատիրոջը անվճար ամրագրումից։\n\nՕգտատիրոջը կուղարկվի հաղորդագրություն՝ բացատրելով պատճառը (ամրագրել է և չի եկել վճարելու)։ Նա դեռ կկարողանա օնլայն վճարել։'
        )
      ) {
        return;
      }
    }
    setBlockingId(userId);
    try {
      const result = await setUserBlocked(userId, block);
      if (result.success) {
        await loadUsers();
        if (viewMode === 'noshow') await loadNoShow();
        if (isDetailModalOpen && userDetails?.user.id === userId) {
          await handleOpenDetails(userId);
        }
      } else {
        alert(result.error || 'Սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error toggling block:', err);
      alert('Սխալ է տեղի ունեցել');
    } finally {
      setBlockingId(null);
    }
  };

  useEffect(() => {
    filterUsers();
  }, [
    users,
    roleFilter,
    blockedFilter,
    tierFilter,
    verifiedFilter,
    sortBy,
    searchQuery,
  ]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAllUsers();
      if (result.success && result.users) {
        setUsers(result.users as UserType[]);
      } else {
        setError(result.error || 'Օգտատերերը բեռնելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Օգտատերերը բեռնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) =>
        parseRoles(u.role).includes(roleFilter)
      );
    }

    if (blockedFilter === 'blocked') {
      filtered = filtered.filter((u) => u.isBlocked);
    } else if (blockedFilter === 'active') {
      filtered = filtered.filter((u) => !u.isBlocked);
    }

    if (tierFilter !== 'all') {
      filtered = filtered.filter((u) => u.bonusTier === tierFilter);
    }

    if (verifiedFilter === 'verified') {
      filtered = filtered.filter((u) => u.phoneVerified);
    } else if (verifiedFilter === 'unverified') {
      filtered = filtered.filter((u) => !u.phoneVerified);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().replace(/\s/g, '');
      const qRaw = searchQuery.toLowerCase();
      filtered = filtered.filter((u) => {
        const phone = (u.phone || '').replace(/\s/g, '').toLowerCase();
        return (
          (u.name && u.name.toLowerCase().includes(qRaw)) ||
          (u.email && u.email.toLowerCase().includes(qRaw)) ||
          phone.includes(query) ||
          String(u.id).includes(query) ||
          (u.referralCode && u.referralCode.toLowerCase().includes(qRaw))
        );
      });
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'tickets':
          return b._count.tickets - a._count.tickets;
        case 'bonus':
          return (b.bonusPoints || 0) - (a.bonusPoints || 0);
        case 'name':
          return (a.name || '').localeCompare(b.name || '', 'hy');
        case 'newest':
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    setFilteredUsers(filtered);
  };

  const resetFilters = () => {
    setRoleFilter('all');
    setBlockedFilter('all');
    setTierFilter('all');
    setVerifiedFilter('all');
    setSortBy('newest');
    setSearchQuery('');
  };

  const hasActiveFilters =
    roleFilter !== 'all' ||
    blockedFilter !== 'all' ||
    tierFilter !== 'all' ||
    verifiedFilter !== 'all' ||
    sortBy !== 'newest' ||
    !!searchQuery.trim();

  const handleOpenDetails = async (userId: number) => {
    setIsDetailModalOpen(true);
    setIsLoadingDetails(true);
    setUserDetails(null);
    setError(null);
    try {
      const result = await getUserDetails(userId);
      if (result.success && result.details) {
        setUserDetails(result.details);
      } else {
        setError(result.error || 'Տվյալները բեռնելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error loading user details:', err);
      setError('Տվյալները բեռնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setIsDetailModalOpen(false);
    setUserDetails(null);
  };

  const handleOpenEditModal = async (userId: number) => {
    try {
      const result = await getUserById(userId);
      if (result.success && result.user) {
        setSelectedUser(result.user as UserType);
        setFormData({
          name: result.user.name || '',
          email: result.user.email || '',
          phone: result.user.phone || '',
          roles: parseRoles(result.user.role),
          phoneVerified: result.user.phoneVerified,
          emailVerified: result.user.emailVerified,
        });
        setError(null);
        setIsEditModalOpen(true);
      }
    } catch (err) {
      console.error('Error loading user:', err);
    }
  };

  const handleCloseModals = () => {
    setIsEditModalOpen(false);
    setIsPasswordModalOpen(false);
    setSelectedUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      roles: ['user'],
      phoneVerified: false,
      emailVerified: false,
    });
    setPasswordData({
      newPassword: '',
      confirmPassword: '',
    });
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    setIsSaving(true);
    setError(null);

    try {
      const result = await updateUser({
        id: selectedUser.id,
        name: formData.name.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        role: serializeRoles(formData.roles),
        phoneVerified: formData.phoneVerified,
        emailVerified: formData.emailVerified,
      });

      if (result.success) {
        await loadUsers();
        handleCloseModals();
      } else {
        setError(result.error || 'Օգտատերը թարմացնելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error saving user:', err);
      setError('Օգտատերը պահպանելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;

    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      setError('Password-ը պետք է լինի առնվազն 6 նիշ');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Password-ները չեն համընկնում');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await changeUserPassword({
        id: selectedUser.id,
        newPassword: passwordData.newPassword,
      });

      if (result.success) {
        handleCloseModals();
        alert('Password-ը հաջողությամբ փոխվեց');
      } else {
        setError(result.error || 'Password-ը փոխելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error changing password:', err);
      setError('Password-ը փոխելիս սխալ է տեղի ունեցել');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (parseInt(currentUser.id) === id) {
      alert('Դուք չեք կարող ջնջել ձեր սեփական հաշիվը');
      return;
    }

    if (!confirm('Դուք համոզված եք, որ ցանկանում եք ջնջել այս օգտատիրին?')) {
      return;
    }

    try {
      const result = await deleteUser(id);
      if (result.success) {
        await loadUsers();
        if (isDetailModalOpen && userDetails?.user.id === id) {
          handleCloseDetails();
        }
      } else {
        alert(result.error || 'Օգտատերը ջնջելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Օգտատերը ջնջելիս սխալ է տեղի ունեցել');
    }
  };

  const formatDate = (date: Date | string) => {
    return formatDateHy(date, { year: true, month: 'short' });
  };

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return '-';
    if (phone.length === 9 && phone.startsWith('0')) {
      return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            Օգտատերեր
          </h1>
          <p className="text-gray-600 mt-1">
            Կառավարեք բոլոր օգտատերերին
            {viewMode === 'all' && !isLoading && (
              <span className="text-gray-400">
                {' '}
                · {filteredUsers.length} / {users.length}
              </span>
            )}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 self-start">
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'all'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Բոլոր օգտատերերը
          </button>
          <button
            onClick={() => setViewMode('noshow')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'noshow'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UserX className="w-4 h-4" />
            Ամրագրել են, չեն եկել
          </button>
        </div>
      </div>

      {viewMode === 'all' && (
        <>
          <div className="mb-6 space-y-3">
            <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Որոնել անուն, հեռախոս, email, ID, հրավերի կոդ..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Մաքրել ֆիլտրերը
                </button>
              )}
        </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="all">Բոլոր դերերը</option>
                {ALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>

              <select
                value={blockedFilter}
                onChange={(e) =>
                  setBlockedFilter(e.target.value as BlockedFilter)
                }
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="all">Բոլոր կարգավիճակները</option>
                <option value="active">Ակտիվ</option>
                <option value="blocked">Արգելափակված</option>
              </select>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="all">Բոլոր մակարդակները</option>
                {BONUS_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {TIER_LABELS_HY[tier]}
                  </option>
                ))}
              </select>

              <select
                value={verifiedFilter}
                onChange={(e) =>
                  setVerifiedFilter(e.target.value as VerifiedFilter)
                }
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="all">Հեռախոս՝ բոլորը</option>
                <option value="verified">Վավերացված</option>
                <option value="unverified">Չվավերացված</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="newest">Նորերը սկզբից</option>
                <option value="tickets">Ըստ տոմսերի</option>
                <option value="bonus">Ըստ բոնուսի</option>
                <option value="name">Ըստ անվան</option>
          </select>
        </div>
      </div>

          {error && !isDetailModalOpen && !isEditModalOpen && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Բեռնվում է...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
                {hasActiveFilters
              ? 'Օգտատերեր չեն գտնվել'
              : 'Օգտատերեր դեռ չկան'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Օգտատեր
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Կոնտակտ
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Դեր
                  </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Բոնուս
                      </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Վիճակագրություն
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Գրանցում
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Գործողություններ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                    <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(u.id)}
                            className="text-left group"
                          >
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2 group-hover:text-purple-700">
                        {u.name || 'Անանուն'}
                              {u.isBlocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                                  <Ban className="w-3 h-3" />
                                  Արգելափակված
                                </span>
                              )}
                      </div>
                            <div className="text-xs text-gray-500">
                              ID: {u.id}
                            </div>
                          </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 space-y-1">
                        {u.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {formatPhone(u.phone)}
                            {u.phoneVerified && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        )}
                        {u.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {u.email}
                            {u.emailVerified && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {parseRoles(u.role).map((role) => (
                      <span
                                key={role}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  roleBadgeStyles[role] ||
                                  'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                                {ROLE_LABELS[role] || role}
                      </span>
                            ))}
                          </div>
                    </td>
                    <td className="px-6 py-4">
                          <div className="text-sm space-y-1">
                            <div className="font-medium text-gray-900">
                              {formatPoints(u.bonusPoints || 0)}
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                tierBadgeStyles[u.bonusTier] ||
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              <Star className="w-3 h-3" />
                              {TIER_LABELS_HY[u.bonusTier] || u.bonusTier}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Ticket className="w-3.5 h-3.5 text-gray-400" />
                              Տոմսեր: {u._count.tickets}
                            </div>
                            <div className="flex items-center gap-1">
                              <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                              Պատվերներ: {u._count.orders}
                            </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(u.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenDetails(u.id)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Մանրամասներ"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                        <button
                          onClick={() => handleOpenEditModal(u.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Խմբագրել"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                            {u.isBlocked ? (
                              <button
                                onClick={() => handleToggleBlock(u.id, false)}
                                disabled={blockingId === u.id}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Ապաարգելափակել"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleBlock(u.id, true)}
                                disabled={blockingId === u.id}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Արգելափակել անվճար ամրագրումից"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                        {parseInt(currentUser.id) !== u.id && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Ջնջել"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          )}
        </>
      )}

      {viewMode === 'noshow' && (
        <>
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Այս ցանկում օգտատերերն են, ովքեր անվճար ամրագրել են տոմս, բայց չեն
              վճարել մինչև ցուցադրության սկիզբը (չեն եկել)։ Կարող եք արգելափակել
              նրանց՝ անվճար ամրագրումը կասեցնելու համար։
            </span>
          </div>

          {isLoadingNoShow ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <p className="mt-4 text-gray-600">Բեռնվում է...</p>
            </div>
          ) : noShowUsers.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
              <UserX className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No-show օգտատերեր չկան</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Օգտատեր
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Կոնտակտ
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Չեկած ամրագրումներ
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Վերջին անգամ
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Գործողություններ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {noShowUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(u.id)}
                            className="text-left"
                          >
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2 hover:text-purple-700">
                              {u.name || 'Անանուն'}
                              {u.isBlocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                                  <Ban className="w-3 h-3" />
                                  Արգելափակված
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {u.id}
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 space-y-1">
                            {u.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-4 h-4 text-gray-400" />
                                {formatPhone(u.phone)}
                              </div>
                            )}
                            {u.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="w-4 h-4 text-gray-400" />
                                {u.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700">
                            {u.noShowCount}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {u.lastNoShowAt
                              ? formatDate(u.lastNoShowAt)
                              : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenDetails(u.id)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Մանրամասներ"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {u.isBlocked ? (
                              <button
                                onClick={() => handleToggleBlock(u.id, false)}
                                disabled={blockingId === u.id}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                <ShieldCheck className="w-4 h-4" />
                                Ապաարգելափակել
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleBlock(u.id, true)}
                                disabled={blockingId === u.id}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                              >
                                <Ban className="w-4 h-4" />
                                Արգելափակել
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {isDetailModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleCloseDetails}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {userDetails?.user.name || 'Անանուն'}
                    </h2>
                    <p className="text-white/90 text-sm">
                      ID: {userDetails?.user.id ?? '…'}
                      {userDetails?.user.isBlocked && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/30 text-white">
                          Արգելափակված
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {userDetails && (
                      <button
                        onClick={() => {
                          handleCloseDetails();
                          handleOpenEditModal(userDetails.user.id);
                        }}
                        className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
                      >
                        Խմբագրել
                      </button>
                    )}
                    <button
                      onClick={handleCloseDetails}
                      className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {isLoadingDetails ? (
                  <div className="text-center py-16">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
                    <p className="mt-3 text-gray-600">Բեռնվում է...</p>
                  </div>
                ) : !userDetails ? (
                  <div className="text-center py-16 text-red-600">
                    {error || 'Տվյալները չեն գտնվել'}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-gray-200 p-4 space-y-2">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          Պրոֆիլ
                        </h3>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {formatPhone(userDetails.user.phone)}
                          {userDetails.user.phoneVerified && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        {userDetails.user.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {userDetails.user.email}
                          </div>
                        )}
                        {userDetails.user.birthDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            Ծննդյան օր՝ {userDetails.user.birthDate}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {parseRoles(userDetails.user.role).map((role) => (
                            <span
                              key={role}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                roleBadgeStyles[role] ||
                                'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {ROLE_LABELS[role] || role}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 pt-1">
                          Գրանցվել է՝ {formatDate(userDetails.user.createdAt)}
                        </div>
                        {userDetails.user.referredBy && (
                          <div className="text-xs text-gray-500">
                            Հրավիրել է՝{' '}
                            {userDetails.user.referredBy.name ||
                              formatPhone(userDetails.user.referredBy.phone)}
                          </div>
                        )}
                        {userDetails.user.referralCode && (
                          <div className="text-xs text-gray-500">
                            Հրավերի կոդ՝ {userDetails.user.referralCode}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-2">
                          <Gift className="w-4 h-4" />
                          Բոնուս
                        </h3>
                        <div className="text-3xl font-bold text-gray-900">
                          {formatPoints(userDetails.user.bonusPoints)}
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              tierBadgeStyles[userDetails.user.bonusTier] ||
                              'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {TIER_LABELS_HY[userDetails.user.bonusTier] ||
                              userDetails.user.bonusTier}
                          </span>
                          <span className="text-gray-600">
                            {userDetails.user.bonusVisits} այց
                          </span>
                          <span className="text-gray-600">
                            {userDetails.stats.referrals} հրավիրված
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        {
                          label: 'Տոմսեր (ընդամենը)',
                          value: userDetails.stats.ticketsTotal,
                          icon: Ticket,
                        },
                        {
                          label: 'Վճարված տոմսեր',
                          value: userDetails.stats.ticketsPaid,
                          icon: CheckCircle,
                        },
                        {
                          label: 'Պատվերներ',
                          value: userDetails.stats.ordersCompleted,
                          icon: ShoppingBag,
                        },
                        {
                          label: 'No-show',
                          value: userDetails.stats.noShowCount,
                          icon: UserX,
                        },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-xl border border-gray-200 p-3"
                        >
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                            <stat.icon className="w-3.5 h-3.5" />
                            {stat.label}
                          </div>
                          <div className="text-xl font-bold text-gray-900">
                            {stat.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Տոմսերի ծախս
                        </div>
                        <div className="text-lg font-semibold">
                          {formatPrice(userDetails.stats.ticketSpend)} ֏
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Պատվերների ծախս
                        </div>
                        <div className="text-lg font-semibold">
                          {formatPrice(userDetails.stats.orderSpend)} ֏
                        </div>
                      </div>
                      <div className="rounded-xl border border-gray-200 p-3">
                        <div className="text-xs text-gray-500 mb-1">
                          Տոմսեր ըստ կարգավիճակի
                        </div>
                        <div className="text-xs text-gray-700 space-y-0.5">
                          {Object.keys(userDetails.stats.ticketsByStatus)
                            .length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            Object.entries(
                              userDetails.stats.ticketsByStatus
                            ).map(([status, count]) => (
                              <div key={status}>
                                {ticketStatusLabels[status] || status}: {count}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Ticket className="w-4 h-4" />
                        Վերջին տոմսեր
                      </h3>
                      {userDetails.recentTickets.length === 0 ? (
                        <p className="text-sm text-gray-400">Տոմսեր չկան</p>
                      ) : (
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Ֆիլմ</th>
                                <th className="px-3 py-2 text-left">Ժամ</th>
                                <th className="px-3 py-2 text-left">Նստատեղ</th>
                                <th className="px-3 py-2 text-left">
                                  Կարգավիճակ
                                </th>
                                <th className="px-3 py-2 text-right">Գին</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {userDetails.recentTickets.map((t) => (
                                <tr key={t.id}>
                                  <td className="px-3 py-2 font-medium text-gray-900">
                                    {t.movieTitle}
                                    {t.noShow && (
                                      <span className="ml-1 text-[10px] text-red-600">
                                        no-show
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                    {formatDateHy(t.startTime, {
                                      month: 'short',
                                    })}{' '}
                                    {formatTimeHy(t.startTime)}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">
                                    {t.seatLabel}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">
                                    {ticketStatusLabels[t.status] || t.status}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-900">
                                    {formatPrice(t.price)} ֏
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        Վերջին պատվերներ
                      </h3>
                      {userDetails.recentOrders.length === 0 ? (
                        <p className="text-sm text-gray-400">Պատվերներ չկան</p>
                      ) : (
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left">#</th>
                                <th className="px-3 py-2 text-left">Ամսաթիվ</th>
                                <th className="px-3 py-2 text-left">
                                  Կարգավիճակ
                                </th>
                                <th className="px-3 py-2 text-left">Ապրանքներ</th>
                                <th className="px-3 py-2 text-right">Գումար</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {userDetails.recentOrders.map((o) => (
                                <tr key={o.id}>
                                  <td className="px-3 py-2 text-gray-500">
                                    #{o.id}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">
                                    {formatDateTimeHy(o.createdAt, {
                                      month: 'short',
                                    })}
                                  </td>
                                  <td className="px-3 py-2">
                                    {orderStatusLabels[o.status] || o.status}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">
                                    {o.itemsCount} ապրանք · {o.ticketsCount}{' '}
                                    տոմս
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium">
                                    {formatPrice(o.totalAmount)} ֏
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Gift className="w-4 h-4" />
                        Բոնուսի շարժ
                      </h3>
                      {userDetails.recentBonus.length === 0 ? (
                        <p className="text-sm text-gray-400">
                          Բոնուսային գործարքներ չկան
                        </p>
                      ) : (
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Ամսաթիվ</th>
                                <th className="px-3 py-2 text-left">Տիպ</th>
                                <th className="px-3 py-2 text-left">
                                  Նկարագրություն
                                </th>
                                <th className="px-3 py-2 text-right">Միավոր</th>
                                <th className="px-3 py-2 text-right">Մնացորդ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {userDetails.recentBonus.map((b) => (
                                <tr key={b.id}>
                                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                    {formatDateTimeHy(b.createdAt, {
                                      month: 'short',
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700">
                                    {BONUS_TYPE_LABELS_HY[b.type] || b.type}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">
                                    {b.description}
                                  </td>
                                  <td
                                    className={`px-3 py-2 text-right font-medium ${
                                      b.points >= 0
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }`}
                                  >
                                    {b.points >= 0 ? '+' : ''}
                                    {b.points}
                                  </td>
                                  <td className="px-3 py-2 text-right text-gray-500">
                                    {b.balanceAfter}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditModalOpen && selectedUser && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleCloseModals}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Խմբագրել օգտատիրին
                    </h2>
                    <p className="text-white/90 text-sm">
                      {selectedUser.name || 'Անանուն'}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseModals}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Անուն
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Էլեկտրոնային հասցե
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id="emailVerified"
                        checked={formData.emailVerified}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emailVerified: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="emailVerified"
                        className="text-sm text-gray-700"
                      >
                        Վավերացված է
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Հեռախոսահամար
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="0XX XXX XXX"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id="phoneVerified"
                        checked={formData.phoneVerified}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phoneVerified: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded"
                      />
                      <label
                        htmlFor="phoneVerified"
                        className="text-sm text-gray-700"
                      >
                        Վավերացված է
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Դերեր (կարող եք ընտրել մի քանիսը)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ALL_ROLES.map((role) => {
                        const checked = formData.roles.includes(role);
                        return (
                          <label
                            key={role}
                            className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors ${
                              checked
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setFormData((prev) => {
                                  const next = e.target.checked
                                    ? [...prev.roles, role]
                                    : prev.roles.filter((r) => r !== role);
                                  return {
                                    ...prev,
                                    roles: next.length ? next : ['user'],
                                  };
                                });
                              }}
                              className="w-4 h-4 text-purple-600 border-gray-300 rounded"
                            />
                            <Shield
                              className={`w-4 h-4 ${
                                checked ? 'text-purple-600' : 'text-gray-400'
                              }`}
                            />
                            <span className="text-sm text-gray-800">
                              {ROLE_LABELS[role]}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Եթե ոչ մի դեր ընտրված չէ, ավտոմատ կնշանակվի «Օգտատեր»։
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-purple-600 bg-purple-50 rounded-lg font-medium hover:bg-purple-100 transition-colors"
                >
                  <Key className="w-4 h-4" />
                  Փոխել password
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCloseModals}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    disabled={isSaving}
                  >
                    Չեղարկել
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Պահպանվում է...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Պահպանել
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPasswordModalOpen && selectedUser && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleCloseModals}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Փոխել password
                    </h2>
                    <p className="text-white/90 text-sm">
                      {selectedUser.name || 'Անանուն'}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseModals}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Նոր password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            newPassword: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Հաստատել password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200">
                <button
                  onClick={handleCloseModals}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={isSaving}
                >
                  Չեղարկել
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Պահպանվում է...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      Փոխել
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
