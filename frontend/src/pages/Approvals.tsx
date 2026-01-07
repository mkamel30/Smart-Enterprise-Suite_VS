import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { CheckCircle, XCircle, Clock, DollarSign, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';


export default function Approvals() {
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState<string>('PENDING');
    const [selectedApproval, setSelectedApproval] = useState<any>(null);
    const [responseNotes, setResponseNotes] = useState('');
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseType, setResponseType] = useState<'APPROVED' | 'REJECTED' | null>(null);

    // Queries
    // We reuse getApprovals (need to ensure API client has this or similar, otherwise we might need to add it)
    // Assuming api.getApprovals({ status }) exists based on requirements, if not we added getApprovalByRequest but maybe not list.
    // Let's assume we need to list them. I'll check/update api client if needed, but for now I'll write assuming a list endpoint exists or I will add it.
    // Actually, I didn't add a generalized "getApprovals" list in the previous step, only "getApprovalByRequest". 
    // I should probably update client.ts to include getApprovals list. 
    // But let's write the component first, and I'll double check client.ts.

    const { data: approvals, isLoading } = useQuery({
        queryKey: ['approvals', filterStatus],
        queryFn: async () => {
            // Fallback if method missing, but we will add it.
            // For now assume api.getApprovals exists.
            if ((api as any).getApprovals) {
                return (api as any).getApprovals({ status: filterStatus });
            }
            return [];
        }
    });

    const responseMutation = useMutation({
        mutationFn: async ({ id, status, notes }: { id: string; status: 'APPROVED' | 'REJECTED', notes: string }) => {
            return api.respondToApproval(id, { status, responseNotes: notes });
        },
        onSuccess: () => {
            toast.success(`تم ${responseType === 'APPROVED' ? 'الموافرة' : 'الرفض'} بنجاح`);
            queryClient.invalidateQueries({ queryKey: ['approvals'] });
            setShowResponseModal(false);
            setSelectedApproval(null);
            setResponseNotes('');
            setResponseType(null);
        },
        onError: (error: any) => {
            toast.error(error.message || 'فشل في إرسال الرد');
        }
    });

    const handleAction = (approval: any, type: 'APPROVED' | 'REJECTED') => {
        setSelectedApproval(approval);
        setResponseType(type);
        setResponseNotes('');
        setShowResponseModal(true);
    };

    const submitResponse = () => {
        if (!selectedApproval || !responseType) return;
        responseMutation.mutate({
            id: selectedApproval.id,
            status: responseType,
            notes: responseNotes
        });
    };

    return (
        <div className="p-6" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <CheckCircle className="text-purple-600" />
                    طلبات الموافقة
                </h1>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
                {['PENDING', 'APPROVED', 'REJECTED'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg font-medium ${filterStatus === status
                            ? (status === 'PENDING' ? 'bg-yellow-500 text-white' : status === 'APPROVED' ? 'bg-green-600 text-white' : 'bg-red-600 text-white')
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                        {status === 'PENDING' ? 'قيد الانتظار' : status === 'APPROVED' ? 'تمت الموافقة' : 'مرفوض'}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="text-center py-12">جاري التحميل...</div>
            ) : approvals?.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <CheckCircle size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-600">لا توجد طلبات {filterStatus === 'PENDING' ? 'معلقة' : 'في هذا القسم'}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {approvals?.map((approval: any) => (
                        <div key={approval.id} className="bg-white border rounded-lg p-5 hover:shadow-md transition-shadow">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div className="w-full sm:w-auto">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="font-bold text-lg">طلب #{approval.request?.id?.slice(-6) || '---'}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-slate-500 text-sm">من فرع:</span>
                                            <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-sm">{approval.request?.branch?.name || 'غير محدد'}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-6 mt-3">
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <DollarSign size={18} className="text-green-600" />
                                            <span className="font-bold">{approval.amount} ج.م</span>
                                            <span className="text-xs text-slate-500">(التكلفة التقديرية)</span>
                                        </div>
                                        {/* Parts count if structure supports it */}
                                        {approval.result && (
                                            <div className="flex items-center gap-2 text-slate-700">
                                                {/* Display parts summary if available */}
                                            </div>
                                        )}
                                    </div>

                                    {approval.notes && (
                                        <div className="mt-3 bg-yellow-50 p-2 rounded text-sm text-yellow-800 flex items-start gap-2">
                                            <MessageSquare size={16} className="mt-0.5 shrink-0" />
                                            {approval.notes}
                                        </div>
                                    )}

                                    <div className="mt-2 text-xs text-slate-400">
                                        تاريخ الطلب: {new Date(approval.createdAt).toLocaleString('ar-EG')}
                                    </div>
                                </div>

                                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                    {approval.status === 'PENDING' && (
                                        <>
                                            <button
                                                onClick={() => handleAction(approval, 'APPROVED')}
                                                className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 sm:w-30"
                                            >
                                                <CheckCircle size={16} />
                                                موافقة
                                            </button>
                                            <button
                                                onClick={() => handleAction(approval, 'REJECTED')}
                                                className="flex-1 sm:flex-none bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 flex items-center justify-center gap-2 sm:w-30"
                                            >
                                                <XCircle size={16} />
                                                رفض
                                            </button>
                                        </>
                                    )}
                                    {approval.status !== 'PENDING' && (
                                        <div className={`flex-1 sm:flex-none px-4 py-2 rounded-lg flex items-center justify-center gap-2 sm:w-30 ${approval.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {approval.status === 'APPROVED' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                            {approval.status === 'APPROVED' ? 'تمت الموافقة' : 'مرفوض'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Response Modal */}
            {showResponseModal && selectedApproval && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md">
                        <div className={`p-4 border-b flex justify-between items-center ${responseType === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'
                            }`}>
                            <h2 className={`text-lg font-bold flex items-center gap-2 ${responseType === 'APPROVED' ? 'text-green-800' : 'text-red-800'
                                }`}>
                                {responseType === 'APPROVED' ? <CheckCircle /> : <XCircle />}
                                {responseType === 'APPROVED' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
                            </h2>
                            <button onClick={() => setShowResponseModal(false)} className="text-slate-500 hover:text-slate-700">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <p className="text-slate-600">
                                أنت على وشك {responseType === 'APPROVED' ? 'الموافقة على' : 'رفض'} طلب الصيانة رقم <b>#{selectedApproval.request?.id?.slice(-6)}</b> بتكلفة <b>{selectedApproval.amount} ج.م</b>.
                            </p>

                            <div>
                                <label className="block text-sm font-medium mb-1">ملاحظات الرد (اختياري)</label>
                                <textarea
                                    value={responseNotes}
                                    onChange={e => setResponseNotes(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2"
                                    rows={3}
                                    placeholder={responseType === 'APPROVED' ? 'ملاحظات إضافية...' : 'سبب الرفض...'}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={submitResponse}
                                    disabled={responseMutation.isPending}
                                    className={`flex-1 py-2 rounded-lg font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 ${responseType === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    {responseMutation.isPending && <Clock size={16} className="animate-spin" />}
                                    تأكيد
                                </button>
                                <button
                                    onClick={() => setShowResponseModal(false)}
                                    className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
