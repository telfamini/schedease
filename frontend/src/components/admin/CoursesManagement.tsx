import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Search } from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'sonner';

interface SubjectItem {
  _id?: string;
  subjectCode: string;
  description: string;
  units?: number;
  schoolYear?: string;
  semester?: string;
  instructorId?: string | null;
  instructorName?: string;
  day?: string;
  time?: string;
  yearLevel?: '1' | '2' | '3' | '4';
  section?: string;
}

type YearLevel = '1' | '2' | '3' | '4';
type Semester = 'First Term' | 'Second Term' | 'Third Term';
type CoursesByYearAndTerm = Record<YearLevel, Record<Semester, SubjectItem[]>>;

export function CoursesManagement() {
  const [coursesByYearAndTerm, setCoursesByYearAndTerm] = useState<CoursesByYearAndTerm>({
    '1': { 'First Term': [], 'Second Term': [], 'Third Term': [] },
    '2': { 'First Term': [], 'Second Term': [], 'Third Term': [] },
    '3': { 'First Term': [], 'Second Term': [], 'Third Term': [] },
    '4': { 'First Term': [], 'Second Term': [], 'Third Term': [] }
  });
  const [selectedTermByYear, setSelectedTermByYear] = useState<Record<YearLevel, Semester>>({
    '1': 'First Term',
    '2': 'First Term',
    '3': 'First Term',
    '4': 'First Term'
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [instructors, setInstructors] = useState<Array<{ _id: string; name: string; email?: string }>>([]);
  const [updatingInstructor, setUpdatingInstructor] = useState<string | null>(null);
  const [importState, setImportState] = useState<{ open: boolean; year?: YearLevel; file: File | null; importing: boolean; result: any | null }>({ open: false, year: undefined, file: null, importing: false, result: null });

  useEffect(() => {
    loadAllYears();
    loadInstructors();
  }, []);

  const loadInstructors = async () => {
    try {
      const response = await apiService.getInstructors();
      const instructorsList = response?.instructors || response?.data || response || [];
      const normalized = instructorsList.map((inst: any) => ({
        _id: inst._id || inst.id,
        name: inst.name || inst.userId?.name || inst.userId?.userId?.name || 'Unknown',
        email: inst.email || inst.userId?.email || ''
      }));
      setInstructors(normalized);
    } catch (error) {
      console.error('Failed to load instructors:', error);
      toast.error('Failed to load instructors');
    }
  };

  const handleInstructorChange = async (courseId: string, instructorId: string | null) => {
    if (!courseId) return;
    
    setUpdatingInstructor(courseId);
    try {
      const updateData: any = {};
      if (instructorId && instructorId !== 'none') {
        updateData.instructorId = instructorId;
      } else {
        updateData.instructorId = null;
      }

      await apiService.updateCourse(courseId, updateData);
      toast.success('Instructor updated successfully');
      await loadAllYears();
    } catch (error: any) {
      console.error('Failed to update instructor:', error);
      toast.error(error?.message || 'Failed to update instructor');
    } finally {
      setUpdatingInstructor(null);
    }
  };

  const loadAllYears = async () => {
    try {
      setLoading(true);
      
      // Fetch courses from the /api/courses endpoint
      const coursesResponse = await apiService.getCourses();
      console.log('Courses loaded:', coursesResponse);
      
      const allCourses = coursesResponse?.courses || coursesResponse?.data || coursesResponse || [];
      
      // Group courses by year level AND term
      const grouped: CoursesByYearAndTerm = {
        '1': { 'First Term': [], 'Second Term': [], 'Third Term': [] },
        '2': { 'First Term': [], 'Second Term': [], 'Third Term': [] },
        '3': { 'First Term': [], 'Second Term': [], 'Third Term': [] },
        '4': { 'First Term': [], 'Second Term': [], 'Third Term': [] }
      };
      
      allCourses.forEach((course: any) => {
        const yearLevel = (course.yearLevel || '1') as YearLevel;
        const semester = (course.semester || 'First Term') as Semester;
        
        if (['1', '2', '3', '4'].includes(yearLevel) && ['First Term', 'Second Term', 'Third Term'].includes(semester)) {
          grouped[yearLevel][semester].push({
            _id: course._id,
            subjectCode: course.code,
            description: course.name || '',
            units: course.credits,
            schoolYear: course.academicYear || '2024-2025',
            semester: course.semester,
            instructorId: course.instructorId?._id || course.instructorId || null,
            instructorName: course.instructorName || course.instructorId?.userId?.name || 'Not Assigned',
            day: undefined,
            time: course.duration ? `${course.duration} min` : undefined,
            yearLevel: course.yearLevel,
            section: course.section
          });
        }
      });
      
      setCoursesByYearAndTerm(grouped);
    } catch (error) {
      console.error('Failed to load courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };
  const reloadYear = async (year: YearLevel) => {
    try {
      // Reload all courses and regroup by year and term
      await loadAllYears();
    } catch (e) {
      console.error('Failed to reload year', year, e);
    }
  };

  const yearMeta: Record<YearLevel, { title: string; color: string }> = {
    '1': { title: 'First Year', color: 'text-blue-700' },
    '2': { title: 'Second Year', color: 'text-green-700' },
    '3': { title: 'Third Year', color: 'text-purple-700' },
    '4': { title: 'Fourth Year', color: 'text-amber-700' }
  };

  const termColors: Record<Semester, string> = {
    'First Term': 'bg-blue-50 border-blue-200',
    'Second Term': 'bg-green-50 border-green-200',
    'Third Term': 'bg-purple-50 border-purple-200'
  };

  const handleTermChange = (year: YearLevel, term: Semester) => {
    setSelectedTermByYear(prev => ({ ...prev, [year]: term }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Controls */}
      <div className="flex items-center justify-between">
        <div className="relative w-96">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Courses grouped by Year with Term Selection */}
      {(['1','2','3','4'] as const).map((year) => {
        const selectedTerm = selectedTermByYear[year];
        const courses = coursesByYearAndTerm[year][selectedTerm];
        const filteredCourses = courses.filter(s =>
          !searchTerm ||
          s.subjectCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.instructorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.section?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Count courses per term for this year
        const termCounts = {
          'First Term': coursesByYearAndTerm[year]['First Term'].length,
          'Second Term': coursesByYearAndTerm[year]['Second Term'].length,
          'Third Term': coursesByYearAndTerm[year]['Third Term'].length
        };

        return (
          <Card key={year}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={yearMeta[year].color}>{yearMeta[year].title} Subjects</CardTitle>
                  <CardDescription>Select a term to view courses</CardDescription>
                </div>
                <div className="flex gap-2">
                  {(['First Term', 'Second Term', 'Third Term'] as const).map((term) => (
                    <Button
                      key={term}
                      variant={selectedTerm === term ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleTermChange(year, term)}
                      className={selectedTerm === term ? 'bg-gray-900 hover:bg-gray-800' : ''}
                    >
                      {term}
                      {termCounts[term] > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="ml-2 bg-white text-gray-900"
                        >
                          {termCounts[term]}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`border rounded-lg p-4 ${termColors[selectedTerm]}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{selectedTerm}</h3>
                  <Badge variant="outline" className="bg-white">
                    {courses.length} course{courses.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="border rounded-lg bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Units</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Instructor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCourses.length > 0 ? (
                        filteredCourses.map((s) => (
                          <TableRow key={s._id || s.subjectCode}>
                            <TableCell className="font-medium font-mono text-sm">{s.subjectCode}</TableCell>
                            <TableCell>{s.description}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{s.section || '-'}</Badge>
                            </TableCell>
                            <TableCell>{s.units ?? '-'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.time || '-'}</TableCell>
                            <TableCell>
                              <Select
                                value={s.instructorId || 'none'}
                                onValueChange={(value) => handleInstructorChange(s._id!, value === 'none' ? null : value)}
                                disabled={updatingInstructor === s._id}
                              >
                                <SelectTrigger className="w-[180px] h-8 text-sm">
                                  <SelectValue placeholder="Select instructor">
                                    {s.instructorName || 'Not Assigned'}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                                  <SelectItem value="none">Not Assigned</SelectItem>
                                  {instructors.map((instructor) => (
                                    <SelectItem key={instructor._id} value={instructor._id}>
                                      {instructor.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                            {searchTerm ? 'No courses match your search' : courses.length === 0 ? 'No courses for this term' : 'No results'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Year-specific Import Dialog */}
      <Dialog open={importState.open} onOpenChange={(open) => setImportState(prev => ({ ...prev, open }))}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Import {importState.year ? yearMeta[importState.year].title : ''} Subjects</DialogTitle>
            <DialogDescription>Upload an Excel file (.xlsx/.xls) to import subjects for this year level.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subjects-year-file">Excel File</Label>
              <Input
                id="subjects-year-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportState(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportState(prev => ({ ...prev, open: false }))}>Cancel</Button>
              <Button
                className="bg-gray-900 hover:bg-gray-800 text-white"
                disabled={!importState.file || !importState.year || importState.importing}
                onClick={async () => {
                  if (!importState.file || !importState.year) return;
                  setImportState(prev => ({ ...prev, importing: true, result: null }));
                  try {
                    const res = await apiService.importSubjects(importState.file, { yearLevel: importState.year });
                    setImportState(prev => ({ ...prev, result: res }));
                    toast.success('Import completed');
                    await reloadYear(importState.year);
                  } catch (err: any) {
                    toast.error(err?.message || 'Import failed');
                  } finally {
                    setImportState(prev => ({ ...prev, importing: false }));
                  }
                }}
              >
                {importState.importing ? 'Importing…' : 'Upload & Import'}
              </Button>
            </div>
            {importState.result && (
              <div className="text-sm text-gray-700 border-t pt-3">
                <div>Inserted: {importState.result.inserted ?? importState.result.insertedCount ?? 0}</div>
                <div>Duplicates: {importState.result.duplicates ?? importState.result.duplicateCount ?? 0}</div>
                {importState.result.schedulesCreated !== undefined && (
                  <div>Schedules Created: {importState.result.schedulesCreated}</div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}