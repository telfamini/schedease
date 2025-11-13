import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Input } from '../ui/input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../services/api';

type Course = {
  _id: string;
  code?: string;
  name?: string;
  description?: string;
  credits?: number;
  yearLevel?: string;
  semester?: string;
  department?: string;
  requiredCapacity?: number;
  schoolYear?: string;
  prerequisite?: string;
  equivalentSubjectCode?: string;
  specialRequirements?: string[];
  type?: string;
  section?: string;
};

const TERMS = ['First Term', 'Second Term', 'Third Term'] as const;
const YEARS = ['1', '2', '3', '4'] as const;

export function CurriculumFix() {
  const [loading, setLoading] = useState<boolean>(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getCourses();
      const allCourses = response.courses || response.data || [];
      setCourses(allCourses);
    } catch (err: any) {
      console.error('Fetch courses error:', err);
      setError(err?.message || 'Failed to load courses');
      toast.error('Failed to load curriculum');
    } finally {
      setLoading(false);
    }
  };

  // Filter courses based on search term
  const filteredCourses = React.useMemo(() => {
    if (!searchTerm) return courses;
    const term = searchTerm.toLowerCase();
    return courses.filter(c => 
      c.code?.toLowerCase().includes(term) ||
      c.name?.toLowerCase().includes(term) ||
      c.description?.toLowerCase().includes(term) ||
      c.prerequisite?.toLowerCase().includes(term) ||
      c.equivalentSubjectCode?.toLowerCase().includes(term) ||
      c.section?.toLowerCase().includes(term) ||
      c.type?.toLowerCase().includes(term)
    );
  }, [courses, searchTerm]);

  // Build grouped structure: yearLevel -> term -> Course[]
  const grouped = React.useMemo(() => {
    const g: Record<string, Record<string, Course[]>> = {};
    for (const y of YEARS) {
      g[y] = {};
      for (const t of TERMS) g[y][t] = [];
    }

    for (const c of filteredCourses) {
      const y = (c.yearLevel && YEARS.includes(c.yearLevel as any)) ? c.yearLevel : '1';
      const s = TERMS.includes((c.semester as any)) ? c.semester as string : 'First Term';
      g[y] = g[y] || {};
      g[y][s] = g[y][s] || [];
      g[y][s].push(c);
    }

    // sort each term list by code
    for (const y of Object.keys(g)) {
      for (const t of Object.keys(g[y])) {
        g[y][t].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      }
    }
    return g;
  }, [filteredCourses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Curriculum</CardTitle>
            <CardDescription>Error loading curriculum</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-red-600">{error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Curriculum</h2>
          <p className="text-sm text-gray-600">All courses grouped by year level and semester</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search courses by code, name, description, section..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white text-gray-900"
        />
      </div>

      {/* Render each Year */}
      {YEARS.map(year => (
        <div key={year} className="space-y-3">
          <h3 className="text-xl font-semibold">Year {year} - Courses</h3>

          {/* For each term in the year render a table */}
          <div className="grid gap-6">
            {TERMS.map(term => {
              const list = grouped[year]?.[term] || [];
              return (
                <Card key={term}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-base font-medium">{term}</span>
                      <span className="text-sm text-gray-600">{list.length} course(s)</span>
                    </CardTitle>
                    <CardDescription>Courses for Year {year} — {term}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {list.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">No courses</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-red-700 text-white">
                              <th className="p-2 border text-left">Subject Code</th>
                              <th className="p-2 border text-left">Prerequisite</th>
                              <th className="p-2 border text-left">Equiv. Subject Code</th>
                              <th className="p-2 border text-left">Description</th>
                              <th className="p-2 border text-center">Units</th>
                              <th className="p-2 border text-left">Type</th>
                              <th className="p-2 border text-left">Section</th>
                              <th className="p-2 border text-left">School Year</th>
                              <th className="p-2 border text-left">Semester</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map((c, idx) => (
                              <tr key={c._id} className={idx % 2 === 0 ? 'bg-red-50' : 'bg-white'}>
                                <td className="p-2 border text-xs font-medium text-blue-700">{c.code || '-'}</td>
                                <td className="p-2 border text-xs">{c.prerequisite || '-'}</td>
                                <td className="p-2 border text-xs">{c.equivalentSubjectCode || '-'}</td>
                                <td className="p-2 border text-xs">{c.name || c.description || '-'}</td>
                                <td className="p-2 border text-center text-xs font-semibold">{c.credits ?? '-'}</td>
                                <td className="p-2 border text-xs">{c.type || '-'}</td>
                                <td className="p-2 border text-xs">{c.section || '-'}</td>
                                <td className="p-2 border text-xs">{c.schoolYear || (c.yearLevel ? `${new Date().getFullYear()}` : '-')}</td>
                                <td className="p-2 border text-xs">{c.semester || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
