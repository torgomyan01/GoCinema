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
  User,
  Phone,
  Mail,
  Calendar,
  Shield,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Ban,
  ShieldCheck,
  UserX,
  Clock,
} from 'lucide-react';
import {
  getAllUsers,
  getUserById,
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

const roleBadgeStyles: Record<string, string> = {
  user: 'bg-gray-100 text-gray-800',
  admin: 'bg-purple-100 text-purple-800',
  moderator: 'bg-blue-100 text-blue-800',
  employee: 'bg-emerald-100 text-emerald-800',
  producer: 'bg-amber-100 text-amber-800',
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
  createdAt: Date | string;
  updatedAt: Date | string;
  _count: {
    tickets: number;
    orders: number;
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

export default function AdminUsersClient({
  user: currentUser,
}: AdminUsersClientProps) {
  const [users, setUsers] = useState<UserType[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserType[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
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
          'Արգելափակե՞լ այս օգտատիրոջը։ Նա այլևս չի կարողանա անվճար ամրագրել (բայց կկարողանա օնլայն վճարել)։'
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
  }, [users, roleFilter, searchQuery]);

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

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) => parseRoles(u.role).includes(roleFilter));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(query)) ||
          (u.email && u.email.toLowerCase().includes(query)) ||
          (u.phone && u.phone.toLowerCase().includes(query))
      );
    }

    setFilteredUsers(filtered);
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
      } else {
        alert(result.error || 'Օգտատերը ջնջելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Օգտատերը ջնջելիս սխալ է տեղի ունեցել');
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('hy-AM', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            Օգտատերեր
          </h1>
          <p className="text-gray-600 mt-1">Կառավարեք բոլոր օգտատերերին</p>
        </div>

        {/* View toggle */}
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
      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Որոնել օգտատերեր..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">Բոլորը</option>
            {ALL_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Users List */}
      {isLoading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Բեռնվում է...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            {searchQuery || roleFilter !== 'all'
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
                    Վիճակագրություն
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Գրանցման ամսաթիվ
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Գործողություններ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        {u.name || 'Անանուն'}
                        {u.isBlocked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                            <Ban className="w-3 h-3" />
                            Արգելափակված
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">ID: {u.id}</div>
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
                              roleBadgeStyles[role] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {ROLE_LABELS[role] || role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        <div>Տոմսեր: {u._count.tickets}</div>
                        <div>Պատվերներ: {u._count.orders}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(u.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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

      {/* No-show view */}
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
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
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

      {/* Edit Modal */}
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
              {/* Header */}
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

              {/* Form */}
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Name */}
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

                  {/* Email */}
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

                  {/* Phone */}
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

                  {/* Roles */}
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

              {/* Footer */}
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

      {/* Password Change Modal */}
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
              {/* Header */}
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

              {/* Form */}
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

              {/* Footer */}
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
