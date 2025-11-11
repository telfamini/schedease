import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import apiService from '../services/api';
import { Badge } from '../ui/badge';

export function AdminScheduleRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState({
    status: 'pending'
  });

  useEffect(() => {
    loadRequests();
  }, [filters]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await apiService.getScheduleRequests();
      setRequests(response.data || []);
    } catch (error) {
      console.error('Failed to load schedule requests:', error);
      toast.error('Failed to load schedule requests');
    } finally {
      setLoading(false);
    }
  };

  // Removed handleProcess - admin can only view schedules now

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const formatSchedule = (schedule?: { dayOfWeek: string; startTime: string; endTime: string } | null) => {
    if (!schedule) return 'N/A';
    return `${schedule.dayOfWeek} ${schedule.startTime} - ${schedule.endTime}`;
  };

  const filteredRequests = filters.status === 'all'
    ? requests
    : requests.filter((req: any) => req.status === filters.status);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Schedule Change Requests</CardTitle>
          <CardDescription>Process instructor schedule change requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conflict</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request: any) => (
                <TableRow key={request._id || request.id}>
                  <TableCell>{request.instructorName || request.instructorId?.userId?.name || 'Unknown'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">
                        {request.requestType === 'borrow_schedule'
                          ? `Borrow schedule${request.originalInstructorName ? ` from ${request.originalInstructorName}` : ''}`
                          : (request.requestType || request.purpose || 'Schedule change')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {request.purpose || request.details || '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{request.roomId?.name || request.roomName || request.scheduleId?.roomName || '—'}</TableCell>
                  <TableCell>{request.date ? new Date(request.date).toLocaleDateString() : (request.dayOfWeek || '—')}</TableCell>
                  <TableCell>
                    {request.startTime && request.endTime
                      ? `${request.startTime} - ${request.endTime}`
                      : formatSchedule(request.scheduleId)}
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {request.conflict_flag ? (
                      <Badge className="bg-red-100 text-red-800">⚠ Conflict Detected</Badge>
                    ) : (
                      <Badge className="bg-green-50 text-green-800">No Conflict</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowDetails(true);
                      }}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4">
                    {loading ? 'Loading...' : 'No schedule requests found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Change Request Details</DialogTitle>
            <DialogDescription>
              Review the schedule change request details
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Instructor</h4>
                  <p className="text-sm text-gray-500">{selectedRequest.instructorName || selectedRequest.instructorId?.userId?.name || 'Unknown'}</p>
                </div>
                <div>
                  <h4 className="font-medium">Request Type</h4>
                  <p className="text-sm text-gray-500">
                    {selectedRequest.requestType === 'borrow_schedule'
                      ? `Borrow schedule${selectedRequest.originalInstructorName ? ` from ${selectedRequest.originalInstructorName}` : ''}`
                      : (selectedRequest.requestType || selectedRequest.purpose || 'Schedule change')}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Course</h4>
                  <p className="text-sm text-gray-500">{selectedRequest.courseName || selectedRequest.courseId?.name || '—'}</p>
                </div>
                <div>
                  <h4 className="font-medium">Requested Schedule</h4>
                  <p className="text-sm text-gray-500">
                    {formatSchedule({ dayOfWeek: selectedRequest.dayOfWeek || '—', startTime: selectedRequest.startTime, endTime: selectedRequest.endTime })}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Current Assignment</h4>
                  <p className="text-sm text-gray-500">
                    {formatSchedule({
                      dayOfWeek: selectedRequest.scheduleId?.dayOfWeek || '—',
                      startTime: selectedRequest.scheduleId?.startTime,
                      endTime: selectedRequest.scheduleId?.endTime
                    })} in {selectedRequest.scheduleId?.roomName || selectedRequest.roomId?.name || '—'}
                    {selectedRequest.originalInstructorName && (
                      <span className="block text-xs text-gray-400">
                        Instructor: {selectedRequest.originalInstructorName}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Borrow Date</h4>
                  <p className="text-sm text-gray-500">
                    {selectedRequest.date ? new Date(selectedRequest.date).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <h4 className="font-medium">Reason</h4>
                  <p className="text-sm text-gray-500">{selectedRequest.purpose || selectedRequest.details || '—'}</p>
                </div>
              </div>

              {Array.isArray(selectedRequest.conflicts) && selectedRequest.conflicts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-700">Conflicts Detected</h4>
                  <ul className="list-disc pl-5 text-sm text-red-700">
                    {selectedRequest.conflicts.map((c: string, idx: number) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <DialogFooter className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowDetails(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}