import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, File as FilePdf, Send, ArrowLeft, DollarSign, Building2, Calendar, User, CheckCircle, XCircle, FileType, Info } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { exportToExcel, exportToPDF } from '../lib/utils/export';
import { MONTHS } from '../types/plan';
import type { StrategicObjective } from '../types/organization';
import type { PlanType } from '../types/plan';

interface PlanReviewTableProps {
  objectives: StrategicObjective[];
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  organizationName: string;
  plannerName: string;
  fromDate: string;
  toDate: string;
  planType: PlanType;
  isPreviewMode?: boolean;
  userOrgId?: number | null;
  isViewOnly?: boolean;
  planData?: any;
}

// Helper function to get selected months for a specific quarter
const getMonthsForQuarter = (selectedMonths: string[], selectedQuarters: string[], quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'): string => {
  if (!selectedMonths && !selectedQuarters) return '-';
  
  // If quarters are selected, show all months in that quarter
  if (selectedQuarters && selectedQuarters.includes(quarter)) {
    const quarterMonths = MONTHS
      .filter(month => month.quarter === quarter)
      .map(month => month.value);
    return quarterMonths.join(', ');
  }
  
  // If individual months are selected, show only selected months for that quarter
  if (selectedMonths && selectedMonths.length > 0) {
    const quarterMonths = MONTHS
      .filter(month => month.quarter === quarter && selectedMonths.includes(month.value))
      .map(month => month.value);
    return quarterMonths.length > 0 ? quarterMonths.join(', ') : '-';
  }
  
  return '-';
};

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch (e) {
    return 'Invalid date';
  }
};

const PlanReviewTable: React.FC<PlanReviewTableProps> = ({
  objectives,
  onSubmit,
  isSubmitting,
  organizationName,
  plannerName,
  fromDate,
  toDate,
  planType,
  isPreviewMode = false,
  userOrgId,
  isViewOnly = false,
  planData
}) => {
  const { t } = useLanguage();
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});

  // Set organizations mapping from planData if available
  useEffect(() => {
    if (planData?.organizationsMap) {
      setOrganizationsMap(planData.organizationsMap);
    }
  }, [planData]);

  // Process objectives data and calculate table rows
  const processTableData = () => {
    if (!objectives || !Array.isArray(objectives) || objectives.length === 0) {
      return [];
    }

    const tableRows: any[] = [];

    objectives.forEach((objective, objIndex) => {
      if (!objective) return;

      const effectiveWeight = objective.effective_weight || objective.planner_weight || objective.weight;
      
      if (!objective.initiatives || objective.initiatives.length === 0) {
        // Objective with no initiatives
        tableRows.push({
          no: objIndex + 1,
          objective: objective.title,
          objectiveWeight: `${effectiveWeight.toFixed(1)}%`,
          initiative: '-',
          initiativeWeight: '-',
          itemName: '-',
          itemType: 'Objective',
          itemWeight: '-',
          baseline: '-',
          q1Target: '-',
          q1Months: '-',
          q2Target: '-',
          q2Months: '-',
          sixMonthTarget: '-',
          q3Target: '-',
          q3Months: '-',
          q4Target: '-',
          q4Months: '-',
          annualTarget: '-',
          implementor: organizationName,
          budgetRequired: 0,
          government: 0,
          partners: 0,
          sdg: 0,
          other: 0,
          totalAvailable: 0,
          gap: 0
        });
        return;
      }

      let objectiveAdded = false;
      
      objective.initiatives.forEach((initiative) => {
        if (!initiative) return;

        // Filter items by user organization
        const performanceMeasures = (initiative.performance_measures || []).filter(measure =>
          !userOrgId || !measure.organization || measure.organization === userOrgId
        );
        const mainActivities = (initiative.main_activities || []).filter(activity =>
          !userOrgId || !activity.organization || activity.organization === userOrgId
        );

        const allItems = [
          ...performanceMeasures.map(item => ({ ...item, type: 'Performance Measure' })),
          ...mainActivities.map(item => ({ ...item, type: 'Main Activity' }))
        ];

        if (allItems.length === 0) {
          // Initiative with no items
          tableRows.push({
            no: objectiveAdded ? '' : (objIndex + 1),
            objective: objectiveAdded ? '' : objective.title,
            objectiveWeight: objectiveAdded ? '' : `${effectiveWeight.toFixed(1)}%`,
            initiative: initiative.name,
            initiativeWeight: `${initiative.weight}%`,
            itemName: '-',
            itemType: 'Initiative',
            itemWeight: '-',
            baseline: '-',
            q1Target: '-',
            q1Months: '-',
            q2Target: '-',
            q2Months: '-',
            sixMonthTarget: '-',
            q3Target: '-',
            q3Months: '-',
            q4Target: '-',
            q4Months: '-',
            annualTarget: '-',
            implementor: initiative.organization_name || organizationsMap[initiative.organization] || organizationName,
            budgetRequired: 0,
            government: 0,
            partners: 0,
            sdg: 0,
            other: 0,
            totalAvailable: 0,
            gap: 0
          });
          objectiveAdded = true;
          return;
        }

        let initiativeAdded = false;

        allItems.forEach((item) => {
          // Calculate budget values for main activities only
          let budgetRequired = 0;
          let government = 0;
          let partners = 0;
          let sdg = 0;
          let other = 0;

          if (item.type === 'Main Activity') {
            // Calculate budget from sub-activities if they exist
            if (item.sub_activities && item.sub_activities.length > 0) {
              item.sub_activities.forEach((subActivity: any) => {
                // Use direct SubActivity model fields
                const subBudgetRequired = subActivity.budget_calculation_type === 'WITH_TOOL'
                  ? Number(subActivity.estimated_cost_with_tool || 0)
                  : Number(subActivity.estimated_cost_without_tool || 0);
                
                budgetRequired += subBudgetRequired;
                government += Number(subActivity.government_treasury || 0);
                partners += Number(subActivity.partners_funding || 0);
                sdg += Number(subActivity.sdg_funding || 0);
                other += Number(subActivity.other_funding || 0);
              });
            } else if (item.budget) {
              // Use legacy budget if no sub-activities
              budgetRequired = item.budget.budget_calculation_type === 'WITH_TOOL' 
                ? Number(item.budget.estimated_cost_with_tool || 0)
                : Number(item.budget.estimated_cost_without_tool || 0);
              
              government = Number(item.budget.government_treasury || 0);
              partners = Number(item.budget.partners_funding || 0);
              sdg = Number(item.budget.sdg_funding || 0);
              other = Number(item.budget.other_funding || 0);
            }
          }

          // Calculate totals
          const totalAvailable = government + partners + sdg + other;
          const gap = Math.max(0, budgetRequired - totalAvailable);

          // Calculate 6-month target
          const sixMonthTarget = item.target_type === 'cumulative' 
            ? Number(item.q1_target || 0) + Number(item.q2_target || 0)
            : Number(item.q2_target || 0);

          // Get selected months for each quarter
          const q1Months = getMonthsForQuarter(item.selected_months || [], item.selected_quarters || [], 'Q1');
          const q2Months = getMonthsForQuarter(item.selected_months || [], item.selected_quarters || [], 'Q2');
          const q3Months = getMonthsForQuarter(item.selected_months || [], item.selected_quarters || [], 'Q3');
          const q4Months = getMonthsForQuarter(item.selected_months || [], item.selected_quarters || [], 'Q4');

          // Add prefix to name
          const displayName = item.type === 'Performance Measure' 
            ? `PM: ${item.name}` 
            : `MA: ${item.name}`;

          tableRows.push({
            no: objectiveAdded ? '' : (objIndex + 1),
            objective: objectiveAdded ? '' : objective.title,
            objectiveWeight: objectiveAdded ? '' : `${effectiveWeight.toFixed(1)}%`,
            initiative: initiativeAdded ? '' : initiative.name,
            initiativeWeight: initiativeAdded ? '' : `${initiative.weight}%`,
            itemName: displayName,
            itemType: item.type,
            itemWeight: `${item.weight}%`,
            baseline: item.baseline || '-',
            q1Target: item.q1_target || 0,
            q1Months: q1Months,
            q2Target: item.q2_target || 0,
            q2Months: q2Months,
            sixMonthTarget: sixMonthTarget,
            q3Target: item.q3_target || 0,
            q3Months: q3Months,
            q4Target: item.q4_target || 0,
            q4Months: q4Months,
            annualTarget: item.annual_target || 0,
            implementor: initiative.organization_name || organizationsMap[initiative.organization] || organizationName,
            budgetRequired,
            government,
            partners,
            sdg,
            other,
            totalAvailable,
            gap
          });
          
          objectiveAdded = true;
          initiativeAdded = true;
        });
      });
    });

    return tableRows;
  };

  const tableData = processTableData();

  const handleExportExcel = () => {
    const exportData = tableData.map(row => ({
      'No': row.no,
      'Strategic Objective': row.objective,
      'Strategic Objective Weight': row.objectiveWeight,
      'Strategic Initiative': row.initiative,
      'Initiative Weight': row.initiativeWeight,
      'Performance Measure/Main Activity': row.itemName,
      'Weight': row.itemWeight,
      'Baseline': row.baseline,
      'Q1Target': row.q1Target,
      'Q1Months': row.q1Months,
      'Q2Target': row.q2Target,
      'Q2Months': row.q2Months,
      'SixMonthTarget': row.sixMonthTarget,
      'Q3Target': row.q3Target,
      'Q3Months': row.q3Months,
      'Q4Target': row.q4Target,
      'Q4Months': row.q4Months,
      'AnnualTarget': row.annualTarget,
      'Implementor': row.implementor,
      'BudgetRequired': row.budgetRequired,
      'Government': row.government,
      'Partners': row.partners,
      'SDG': row.sdg,
      'Other': row.other,
      'TotalAvailable': row.totalAvailable,
      'Gap': row.gap
    }));

    exportToExcel(
      exportData,
      `plan-${new Date().toISOString().slice(0, 10)}`,
      'en',
      {
        organization: organizationName,
        planner: plannerName,
        fromDate: fromDate,
        toDate: toDate,
        planType: planType
      }
    );
  };

  const handleExportPDF = () => {
    const exportData = tableData.map(row => ({
      'No': row.no,
      'Strategic Objective': row.objective,
      'Strategic Objective Weight': row.objectiveWeight,
      'Strategic Initiative': row.initiative,
      'Initiative Weight': row.initiativeWeight,
      'Performance Measure/Main Activity': row.itemName,
      'Weight': row.itemWeight,
      'Baseline': row.baseline,
      'Q1Target': row.q1Target,
      'Q1Months': row.q1Months,
      'Q2Target': row.q2Target,
      'Q2Months': row.q2Months,
      'SixMonthTarget': row.sixMonthTarget,
      'Q3Target': row.q3Target,
      'Q3Months': row.q3Months,
      'Q4Target': row.q4Target,
      'Q4Months': row.q4Months,
      'AnnualTarget': row.annualTarget,
      'Implementor': row.implementor,
      'BudgetRequired': row.budgetRequired,
      'Government': row.government,
      'Partners': row.partners,
      'SDG': row.sdg,
      'Other': row.other,
      'TotalAvailable': row.totalAvailable,
      'Gap': row.gap
    }));

    exportToPDF(
      exportData,
      `plan-${new Date().toISOString().slice(0, 10)}`,
      'en',
      {
        organization: organizationName,
        planner: plannerName,
        fromDate: fromDate,
        toDate: toDate,
        planType: planType
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Plan Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <Building2 className="h-6 w-6 mr-2 text-green-600" />
          {organizationName || 'Organization'} - Strategic Plan
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Planner:</span>
            <div className="font-medium">{plannerName || 'Not specified'}</div>
          </div>
          <div>
            <span className="text-gray-500">Plan Type:</span>
            <div className="font-medium">{planType || 'Not specified'}</div>
          </div>
          <div>
            <span className="text-gray-500">From:</span>
            <div className="font-medium">{formatDate(fromDate)}</div>
          </div>
          <div>
            <span className="text-gray-500">To:</span>
            <div className="font-medium">{formatDate(toDate)}</div>
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      {!isPreviewMode && (
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleExportExcel}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FilePdf className="h-4 w-4 mr-2" />
            Export PDF
          </button>
        </div>
      )}

      {/* Strategic Plan Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategic Objective</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Strategic Initiative</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance Measure/Main Activity</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Baseline</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Q1 Target<br/>(Jul-Sep)</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Q2 Target<br/>(Oct-Dec)</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">6-Month Target</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Q3 Target<br/>(Jan-Mar)</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Q4 Target<br/>(Apr-Jun)</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Annual Target</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Implementor</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget Required</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Government</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partners</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SDG</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Other</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Available</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gap</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableData.map((row, index) => (
                <tr key={`table-row-${index}`} className="hover:bg-gray-50">
                  <td className="px-3 py-4 text-sm text-gray-900">{row.no}</td>
                  <td className="px-3 py-4 text-sm text-gray-900">{row.objective}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">{row.objectiveWeight}</td>
                  <td className="px-3 py-4 text-sm text-gray-900">{row.initiative}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">{row.initiativeWeight}</td>
                  <td className="px-3 py-4 text-sm text-gray-900">{row.itemName}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">{row.itemWeight}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">{row.baseline}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">
                    <div>{row.q1Target}</div>
                    <div className="text-xs text-gray-400 mt-1">{row.q1Months}</div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-600">
                    <div>{row.q2Target}</div>
                    <div className="text-xs text-gray-400 mt-1">{row.q2Months}</div>
                  </td>
                  <td className="px-3 py-4 text-sm font-medium text-blue-600">{row.sixMonthTarget}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">
                    <div>{row.q3Target}</div>
                    <div className="text-xs text-gray-400 mt-1">{row.q3Months}</div>
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-600">
                    <div>{row.q4Target}</div>
                    <div className="text-xs text-gray-400 mt-1">{row.q4Months}</div>
                  </td>
                  <td className="px-3 py-4 text-sm font-medium text-green-600">{row.annualTarget}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">{row.implementor}</td>
                  <td className="px-3 py-4 text-sm font-medium text-green-600">${row.budgetRequired.toLocaleString()}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">${row.government.toLocaleString()}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">${row.partners.toLocaleString()}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">${row.sdg.toLocaleString()}</td>
                  <td className="px-3 py-4 text-sm text-gray-600">${row.other.toLocaleString()}</td>
                  <td className="px-3 py-4 text-sm font-medium text-blue-600">${row.totalAvailable.toLocaleString()}</td>
                  <td className="px-3 py-4 text-sm font-medium text-red-600">${row.gap.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Button */}
      {!isPreviewMode && !isViewOnly && (
        <div className="flex justify-end">
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting Plan...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Submit Plan for Review
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanReviewTable;