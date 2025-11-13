import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { apiService } from '../services/api';
import { toast } from 'sonner';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  CheckCircle, 
  XCircle,
  Search,
  UserCheck,
  UserX
} from 'lucide-react';

interface Instructor {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    department?: string;
    isActive?: boolean;
  };
  specialization?: string;
  officeHours?: string;
  createdAt?: string;
}

export function InstructorsManagement() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadInstructors();
  }, []);

  const loadInstructors = async () => {
    try {
      setLoading(true);
      const response = await apiService.getInstructors();
      const allInstructors = response.instructors || response.data || [];
      setInstructors(allInstructors);
    } catch (error) {
      console.error('Failed to load instructors:', error);
      toast.error('Failed to load instructors');
    } finally {
      setLoading(false);
    }
  };

  const toggleInstructorStatus = async (instructorId: string, userId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      
      // Call API to update user status
      await fetch(`http://localhost:3001/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isActive: newStatus })
      });

      // Update local state
      setInstructors(prev => prev.map(instructor => 
        instructor._id === instructorId
          ? { ...instructor, userId: { ...instructor.userId, isActive: newStatus } }
          : instructor
      ));

      toast.success(`Instructor ${newStatus ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Failed to update instructor status:', error);
      toast.error('Failed to update instructor status');
    }
  };

  const filteredInstructors = instructors.filter(instructor => {
    const matchesSearch = 
      instructor.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instructor.userId?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instructor.userId?.department?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && instructor.userId?.isActive !== false) ||
      (filterStatus === 'inactive' && instructor.userId?.isActive === false);

    return matchesSearch && matchesStatus;
  });

  const activeCount = instructors.filter(i => i.userId?.isActive !== false).length;
  const inactiveCount = instructors.filter(i => i.userId?.isActive === false).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Instructors Management</h2>
          <p className="text-sm text-gray-600">
            Manage instructor accounts and permissions
          </p>
        </div>
        <Button onClick={loadInstructors} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Instructors</p>
                <p className="text-3xl font-bold text-gray-900">{instructors.length}</p>
              </div>
              <User className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-3xl font-bold text-green-600">{activeCount}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-3xl font-bold text-red-600">{inactiveCount}</p>
              </div>
              <UserX className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
                size="sm"
              >
                All ({instructors.length})
              </Button>
              <Button
                variant={filterStatus === 'active' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('active')}
                size="sm"
              >
                Active ({activeCount})
              </Button>
              <Button
                variant={filterStatus === 'inactive' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('inactive')}
                size="sm"
              >
                Inactive ({inactiveCount})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructors List */}
      <Card>
        <CardHeader>
          <CardTitle>Instructors ({filteredInstructors.length})</CardTitle>
          <CardDescription>
            {searchTerm && `Showing results for "${searchTerm}"`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInstructors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No instructors found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInstructors.map((instructor) => {
                const isActive = instructor.userId?.isActive !== false;
                
                return (
                  <div
                    key={instructor._id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      {/* Avatar */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <User className="h-6 w-6" />
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {instructor.userId?.name || 'Unknown'}
                          </h3>
                          <Badge variant={isActive ? 'default' : 'secondary'}>
                            {isActive ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" /> Inactive</>
                            )}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4" />
                            <span>{instructor.userId?.email || 'No email'}</span>
                          </div>

                          {instructor.userId?.department && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Building2 className="h-4 w-4" />
                              <span>{instructor.userId.department}</span>
                            </div>
                          )}

                          {instructor.userId?.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-4 w-4" />
                              <span>{instructor.userId.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant={isActive ? 'destructive' : 'default'}
                        size="sm"
                        onClick={() => toggleInstructorStatus(
                          instructor._id,
                          instructor.userId._id,
                          isActive
                        )}
                      >
                        {isActive ? (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Disable
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Enable
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
