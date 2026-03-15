import React from 'react';
import { DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface MaintenanceCostCardProps {
    estimatedCost: number;
    finalCost: number;
}

const MaintenanceCostCard: React.FC<MaintenanceCostCardProps> = ({ estimatedCost, finalCost }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <DollarSign size={18} />
                    التكاليف
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">التكلفة المقدرة</p>
                        <p className="text-2xl font-bold">{estimatedCost || 0} ج.م</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
                        <p className="text-sm text-green-600">التكلفة النهائية</p>
                        <p className="text-2xl font-bold text-green-700">{finalCost || 0} ج.م</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default MaintenanceCostCard;
