import React from 'react';
import { Award } from 'lucide-react';
import { COLORS } from './ExecutiveDashboardConstants';
import type { ExecutiveData } from './ExecutiveDashboardTypes';

interface BranchRankingTableProps {
    branches: ExecutiveData['branchSummary'];
    onBranchClick?: (branchId: string) => void;
}

const BranchRankingTable: React.FC<BranchRankingTableProps> = ({ branches, onBranchClick }) => {
    if (!branches || branches.length === 0) return null;

    return (
        <div className="ranking-table-container">
            <h3 className="section-title">
                <Award size={20} />
                تصنيف الفروع
                <span className="click-hint">اضغط للتفاصيل</span>
            </h3>
            <table className="ranking-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>الفرع</th>
                        <th>الإيراد</th>
                        <th>نشط</th>
                        <th>مغلق</th>
                        <th>نسبة الإغلاق</th>
                    </tr>
                </thead>
                <tbody>
                    {branches.slice(0, 10).map((branch, index) => (
                        <tr
                            key={branch.id}
                            className={`${index < 3 ? 'top-performer' : ''} clickable-row`}
                            onClick={() => onBranchClick?.(branch.id)}
                        >
                            <td className="rank-cell">
                                {index === 0 && '🥇'}
                                {index === 1 && '🥈'}
                                {index === 2 && '🥉'}
                                {index > 2 && index + 1}
                            </td>
                            <td className="branch-name">{branch.name}</td>
                            <td className="revenue">{(branch.revenue / 1000).toFixed(0)}ألف ج.م</td>
                            <td className="active-reqs">{branch.activeRequests}</td>
                            <td className="closed-reqs">{branch.closedRequests}</td>
                            <td className="closure-rate">
                                <div className="progress-bar-mini">
                                    <div
                                        className="progress-fill"
                                        style={{
                                            width: `${branch.closureRate}%`,
                                            backgroundColor: branch.closureRate >= 90 ? COLORS.success : branch.closureRate >= 70 ? COLORS.warning : COLORS.danger
                                        }}
                                    />
                                </div>
                                <span>{branch.closureRate}%</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default BranchRankingTable;
