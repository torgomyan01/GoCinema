'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Trash2,
  X,
  Eye,
  CheckCircle,
  Archive,
  Filter,
  Search,
  User,
  Phone,
  Calendar,
} from 'lucide-react';
import {
  getAllContacts,
  getContactById,
  updateContactStatus,
  deleteContact,
} from '@/app/actions/contacts';

interface AdminContactsClientProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
  };
}

interface Contact {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  userId?: number | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: number;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export default function AdminContactsClient({
  user,
}: AdminContactsClientProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, statusFilter, searchQuery]);

  const loadContacts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAllContacts();
      if (result.success && result.contacts) {
        setContacts(result.contacts as Contact[]);
      } else {
        setError(
          result.error || 'Հաղորդագրությունները բեռնելիս սխալ է տեղի ունեցել'
        );
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError('Հաղորդագրությունները բեռնելիս սխալ է տեղի ունեցել');
    } finally {
      setIsLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = [...contacts];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((contact) => contact.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.subject.toLowerCase().includes(query) ||
          contact.message.toLowerCase().includes(query) ||
          (contact.email && contact.email.toLowerCase().includes(query)) ||
          (contact.phone && contact.phone.toLowerCase().includes(query))
      );
    }

    setFilteredContacts(filtered);
  };

  const handleViewContact = async (id: number) => {
    try {
      const result = await getContactById(id);
      if (result.success && result.contact) {
        setSelectedContact(result.contact as Contact);
        setIsDetailModalOpen(true);

        // Mark as read if it's new
        if (result.contact.status === 'new') {
          await updateContactStatus({ id, status: 'read' });
          await loadContacts();
        }
      }
    } catch (err) {
      console.error('Error loading contact:', err);
    }
  };

  const handleUpdateStatus = async (
    id: number,
    status: 'new' | 'read' | 'replied' | 'archived'
  ) => {
    try {
      const result = await updateContactStatus({ id, status });
      if (result.success) {
        await loadContacts();
        if (selectedContact?.id === id) {
          setSelectedContact({ ...selectedContact, status });
        }
      }
    } catch (err) {
      console.error('Error updating contact status:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm('Դուք համոզված եք, որ ցանկանում եք ջնջել այս հաղորդագրությունը?')
    ) {
      return;
    }

    try {
      const result = await deleteContact(id);
      if (result.success) {
        await loadContacts();
        if (selectedContact?.id === id) {
          setIsDetailModalOpen(false);
          setSelectedContact(null);
        }
      } else {
        alert(result.error || 'Հաղորդագրությունը ջնջելիս սխալ է տեղի ունեցել');
      }
    } catch (err) {
      console.error('Error deleting contact:', err);
      alert('Հաղորդագրությունը ջնջելիս սխալ է տեղի ունեցել');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      new: { label: 'Նոր', color: 'bg-blue-100 text-blue-800', icon: Mail },
      read: {
        label: 'Կարդացված',
        color: 'bg-gray-100 text-gray-800',
        icon: Eye,
      },
      replied: {
        label: 'Պատասխանված',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle,
      },
      archived: {
        label: 'Արխիվ',
        color: 'bg-yellow-100 text-yellow-800',
        icon: Archive,
      },
    };
    return badges[status as keyof typeof badges] || badges.new;
  };

  const newContactsCount = contacts.filter((c) => c.status === 'new').length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Mail className="w-6 h-6 text-purple-600" />
            </div>
            Կոնտակտներ
            {newContactsCount > 0 && (
              <span className="px-3 py-1 bg-red-500 text-white text-sm font-semibold rounded-full">
                {newContactsCount} նոր
              </span>
            )}
          </h1>
          <p className="text-gray-600 mt-1">
            Կառավարեք օգտատերերի հաղորդագրությունները
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Որոնել հաղորդագրություններ..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">Բոլորը</option>
            <option value="new">Նոր</option>
            <option value="read">Կարդացված</option>
            <option value="replied">Պատասխանված</option>
            <option value="archived">Արխիվ</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Contacts List */}
      {isLoading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Բեռնվում է...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            {searchQuery || statusFilter !== 'all'
              ? 'Հաղորդագրություններ չեն գտնվել'
              : 'Հաղորդագրություններ դեռ չկան'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Անուն
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Կոնտակտ
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Թեմա
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Կարգավիճակ
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ամսաթիվ
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Գործողություններ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContacts.map((contact) => {
                  const statusBadge = getStatusBadge(contact.status);
                  const StatusIcon = statusBadge.icon;
                  return (
                    <tr
                      key={contact.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        contact.status === 'new' ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {contact.name}
                        </div>
                        {contact.user && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" />
                            Գրանցված օգտատեր
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {contact.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-4 h-4 text-gray-400" />
                              {contact.email}
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-1 mt-1">
                              <Phone className="w-4 h-4 text-gray-400" />
                              {contact.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {contact.subject}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(contact.createdAt).toLocaleDateString(
                            'hy-AM',
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewContact(contact.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Դիտել"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(contact.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Ջնջել"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedContact && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsDetailModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {selectedContact.subject}
                    </h2>
                    <p className="text-white/90 text-sm">
                      {selectedContact.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-6">
                  {/* Contact Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Անուն
                      </label>
                      <p className="text-gray-900 font-medium">
                        {selectedContact.name}
                      </p>
                    </div>
                    {selectedContact.email && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Էլեկտրոնային հասցե
                        </label>
                        <a
                          href={`mailto:${selectedContact.email}`}
                          className="text-purple-600 hover:text-purple-700"
                        >
                          {selectedContact.email}
                        </a>
                      </div>
                    )}
                    {selectedContact.phone && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Հեռախոսահամար
                        </label>
                        <a
                          href={`tel:${selectedContact.phone}`}
                          className="text-purple-600 hover:text-purple-700"
                        >
                          {selectedContact.phone}
                        </a>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Ամսաթիվ
                      </label>
                      <p className="text-gray-900">
                        {new Date(selectedContact.createdAt).toLocaleString(
                          'hy-AM',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      Հաղորդագրություն
                    </label>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {selectedContact.message}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Կարգավիճակ:</span>
                  <select
                    value={selectedContact.status}
                    onChange={(e) =>
                      handleUpdateStatus(
                        selectedContact.id,
                        e.target.value as
                          | 'new'
                          | 'read'
                          | 'replied'
                          | 'archived'
                      )
                    }
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="new">Նոր</option>
                    <option value="read">Կարդացված</option>
                    <option value="replied">Պատասխանված</option>
                    <option value="archived">Արխիվ</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  {selectedContact.email && (
                    <a
                      href={`mailto:${selectedContact.email}?subject=Re: ${selectedContact.subject}`}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm"
                    >
                      Պատասխանել
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(selectedContact.id)}
                    className="px-4 py-2 text-red-600 bg-red-50 rounded-lg font-medium hover:bg-red-100 transition-colors text-sm"
                  >
                    Ջնջել
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
