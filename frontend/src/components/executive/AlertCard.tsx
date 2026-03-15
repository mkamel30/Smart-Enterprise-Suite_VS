import React from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { ExecutiveData } from './ExecutiveDashboardTypes';

interface AlertCardProps {
    alerts: ExecutiveData['alerts'];
}

const AlertCard: React.FC<AlertCardProps> = ({ alerts }) => {
    if (!alerts || alerts.length === 0) {
        return (
            <div className="alert-card success">
                <CheckCircle size={24} />
                <span>لا توجد تنبيهات حرجة</span>
            </div>
        );
    }

    return (
        <div className="alerts-container">
            <h3 className="section-title">
                <AlertTriangle size={20} />
                تنبيهات تحتاج انتباهك
            </h3>
            <div className="alerts-list">
                {Array.isArray(alerts) && alerts.map((alert, index) => (
                    <div key={index} className={`alert-item ${alert.severity}`}>
                        <div className="alert-icon">
                            {alert.severity === 'critical' ? <AlertTriangle size={18} /> : <Clock size={18} />}
                        </div>
                        <div className="alert-content">
                            <span className="alert-message">{alert.message}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AlertCard;
