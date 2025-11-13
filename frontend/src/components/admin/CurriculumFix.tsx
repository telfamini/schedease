import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { AlertCircle, CheckCircle, Wrench, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosisData {
  totalCourses: number;
  coursesWithYearLevel: number;
  coursesWithSemester: number;
  coursesWithDepartment: number;
  coursesWithAll: number;
  needsFix: boolean;
  issues: string[];
  sampleCourses: any[];
  departments: string[];
}

export function CurriculumFix() {
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [defaultDepartment, setDefaultDepartment] = useState('IT');
  const [defaultSemester, setDefaultSemester] = useState('First Term');

  useEffect(() => {
    runDiagnosis();
  }, []);

  const runDiagnosis = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/admin/courses/diagnose', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to diagnose');

      const result = await response.json();
      if (result.success) {
        setDiagnosis(result.data);
      }
    } catch (error) {
      console.error('Diagnosis error:', error);
      toast.error('Failed to diagnose courses');
    } finally {
      setLoading(false);
    }
  };

  const runFix = async () => {
    try {
      setFixing(true);
      const response = await fetch('http://localhost:3001/api/admin/courses/fix', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          defaultDepartment,
          defaultSemester
        })
      });

      if (!response.ok) throw new Error('Failed to fix');

      const result = await response.json();
      if (result.success) {
        toast.success(result.message);
        // Re-run diagnosis to see updated results
        await runDiagnosis();
      }
    } catch (error) {
      console.error('Fix error:', error);
      toast.error('Failed to fix courses');
    } finally {
      setFixing(false);
    }
  };

  if (loading && !diagnosis) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Curriculum Data Fix</h2>
          <p className="text-muted-foreground">Diagnose and fix missing course fields for curriculum display</p>
        </div>
        <Button onClick={runDiagnosis} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Re-diagnose
        </Button>
      </div>

      {diagnosis && (
        <>
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {diagnosis.needsFix ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <span>Issues Found</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>All Good!</span>
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {diagnosis.needsFix 
                  ? 'Some courses are missing required fields for curriculum display'
                  : 'All courses have the required fields'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Courses</p>
                  <p className="text-2xl font-bold">{diagnosis.totalCourses}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">With Year Level</p>
                  <p className="text-2xl font-bold">{diagnosis.coursesWithYearLevel}</p>
                  {diagnosis.coursesWithYearLevel < diagnosis.totalCourses && (
                    <Badge variant="destructive" className="text-xs">
                      {diagnosis.totalCourses - diagnosis.coursesWithYearLevel} missing
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">With Semester</p>
                  <p className="text-2xl font-bold">{diagnosis.coursesWithSemester}</p>
                  {diagnosis.coursesWithSemester < diagnosis.totalCourses && (
                    <Badge variant="destructive" className="text-xs">
                      {diagnosis.totalCourses - diagnosis.coursesWithSemester} missing
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">With Department</p>
                  <p className="text-2xl font-bold">{diagnosis.coursesWithDepartment}</p>
                  {diagnosis.coursesWithDepartment < diagnosis.totalCourses && (
                    <Badge variant="destructive" className="text-xs">
                      {diagnosis.totalCourses - diagnosis.coursesWithDepartment} missing
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Issues List */}
          {diagnosis.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Issues Detected</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {diagnosis.issues.map((issue, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Sample Courses */}
          <Card>
            <CardHeader>
              <CardTitle>Sample Courses</CardTitle>
              <CardDescription>First 5 courses in the database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {diagnosis.sampleCourses.map((course, idx) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{course.code} - {course.name}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant={course.department ? "default" : "destructive"}>
                            Dept: {course.department || 'MISSING'}
                          </Badge>
                          <Badge variant={course.yearLevel ? "default" : "destructive"}>
                            Year: {course.yearLevel || 'MISSING'}
                          </Badge>
                          <Badge variant={course.semester ? "default" : "destructive"}>
                            Semester: {course.semester || 'MISSING'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Fix Section */}
          {diagnosis.needsFix && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Fix Missing Fields
                </CardTitle>
                <CardDescription>
                  Set default values for missing fields. The system will attempt to extract year level from course codes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Department</label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={defaultDepartment}
                      onChange={(e) => setDefaultDepartment(e.target.value)}
                    >
                      <option value="IT">IT</option>
                      <option value="CS">CS</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Business">Business</option>
                      <option value="Science">Science</option>
                      {diagnosis.departments.filter(d => d && !['IT', 'CS', 'Engineering', 'Business', 'Science'].includes(d)).map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Default Semester</label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={defaultSemester}
                      onChange={(e) => setDefaultSemester(e.target.value)}
                    >
                      <option value="First Term">First Term</option>
                      <option value="Second Term">Second Term</option>
                      <option value="Third Term">Third Term</option>
                    </select>
                  </div>
                </div>

                <Button onClick={runFix} disabled={fixing} className="w-full">
                  {fixing ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Fixing...
                    </>
                  ) : (
                    <>
                      <Wrench className="h-4 w-4 mr-2" />
                      Fix Courses Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Departments Info */}
          <Card>
            <CardHeader>
              <CardTitle>Departments in Database</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {diagnosis.departments.length > 0 ? (
                  diagnosis.departments.map(dept => (
                    <Badge key={dept} variant="outline">
                      {dept || '(no department)'}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No departments found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
