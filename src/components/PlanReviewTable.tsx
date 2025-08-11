import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, File as FilePdf, Send, AlertCircle, CheckCircle, DollarSign, Building2, Target, Activity, BarChart3, Info, Loader } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { organizations, auth } from '../lib/api';
import type { StrategicObjective } from '../types/organization';
import type { PlanType } from '../types/plan';
import { exportToExcel, exportToPDF, processDataForExport } from '../lib/utils/export';

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
  userOrgId = null,
  isViewOnly = false,
  planData = null
}) => {
  const { t } = useLanguage();
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  const [processedObjectives, setProcessedObjectives] = useState<StrategicObjective[]>([]);

  // Determine the effective user organization ID
  const effectiveUserOrgId = userOrgId || planData?.organization || null;

  // Fetch organizations for mapping names
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await organizations.getAll();
        const orgMap: Record<string, string> = {};
        
        if (response && Array.isArray(response)) {
          response.forEach((org: any) => {
            if (org && org.id) {
              orgMap[org.id] = org.name;
            }
          });
        }
        
        setOrganizationsMap(orgMap);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      }
    };
    
    fetchOrganizations();
  }, []);

  // Process objectives when data changes
  useEffect(() => {
    if (!effectiveUserOrgId || !objectives?.length) {
      console.log('PlanReviewTable: Missing organization ID or objectives');
      setProcessedObjectives([]);
      return;
    }

    console.log('PlanReviewTable: Processing objectives with organization filter:', effectiveUserOrgId);
    
    try {
      const filteredObjectives = objectives.map(objective => {
        if (!objective) return objective;

        // Process initiatives for this objective
        const userInitiatives = (objective.initiatives || []).filter(initiative => {
          const isDefault = initiative.is_default === true;
          const belongsToUserOrg = Number(initiative.organization) === Number(effectiveUserOrgId);
          const hasNoOrg = !initiative.organization;
          const belongsToOtherOrg = initiative.organization && Number(initiative.organization) !== Number(effectiveUserOrgId);
          
          const shouldInclude = (isDefault || belongsToUserOrg || hasNoOrg) && !belongsToOtherOrg;
          
          console.log(`Initiative "${initiative.name}": org=${initiative.organization}, userOrg=${effectiveUserOrgId}, shouldInclude=${shouldInclude}`);
          
          return shouldInclude;
        });

        // For each initiative, filter measures and activities
        const processedInitiatives = userInitiatives.map(initiative => {
          const filteredMeasures = (initiative.performance_measures || []).filter(measure => {
            const belongsToUserOrg = !measure.organization || Number(measure.organization) === Number(effectiveUserOrgId);
            return belongsToUserOrg;
          });

          const filteredActivities = (initiative.main_activities || []).filter(activity => {
            const belongsToUserOrg = !activity.organization || Number(activity.organization) === Number(effectiveUserOrgId);
            return belongsToUserOrg;
          });

          return {
            ...initiative,
            performance_measures: filteredMeasures,
            main_activities: filteredActivities
          };
        });

        return {
          ...objective,
          initiatives: processedInitiatives
        };
      });

      setProcessedObjectives(filteredObjectives);
    } catch (error) {
      console.error('Error processing objectives:', error);
      setProcessedObjectives([]);
    }
  }, [objectives, effectiveUserOrgId]);

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  const calculateTotals = () => {
    let totalRequired = 0;
    let totalGovernment = 0;
    let totalPartners = 0;
    let totalSDG = 0;
    let totalOther = 0;

    processedObjectives.forEach(objective => {
      objective.initiatives?.forEach(initiative => {
        initiative.main_activities?.forEach(activity => {
          if (activity.budget) {
            const required = activity.budget.budget_calculation_type === 'WITH_TOOL' 
              ? Number(activity.budget.estimated_cost_with_tool || 0)
              : Number(activity.budget.estimated_cost_without_tool || 0);
            
            totalRequired += required;
            totalGovernment += Number(activity.budget.government_treasury || 0);
            totalPartners += Number(activity.budget.partners_funding || 0);
            totalSDG += Number(activity.budget.sdg_funding || 0);
            totalOther += Number(activity.budget.other_funding || 0);
          }
        });
      });
    });

    const totalAvailable = totalGovernment + totalPartners + totalSDG + totalOther;
    const totalGap = Math.max(0, totalRequired - totalAvailable);

    return {
      totalRequired,
      totalGovernment,
      totalPartners,
      totalSDG,
      totalOther,
      totalAvailable,
      totalGap
    };
  };

  const totals = calculateTotals();

  const handleSubmitPlan = async () => {
    setIsSubmittingPlan(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await onSubmit();
      setSubmitSuccess('Plan submitted successfully!');
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to submit plan');
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = processDataForExport(processedObjectives, 'en');
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
    const exportData = processDataForExport(processedObjectives, 'en');
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

  // Show loading if no organization context
  if (!effectiveUserOrgId) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="h-6 w-6 animate-spin mr-2" />
        <span className="text-gray-600">Loading...</span>
      </div>
    );
  }

  // Show message if no objectives
  if (!processedObjectives || processedObjectives.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
        <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Plan Data</h3>
        <p className="text-gray-500">No objectives or plan data available to display.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <Building2 className="h-6 w-6 mr-2 text-green-600" />
          {organizationName} - Strategic Plan
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Planner:</span>
            <div className="font-medium">{plannerName}</div>
          </div>
          <div>
            <span className="text-gray-500">Plan Type:</span>
            <div className="font-medium">{planType}</div>
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

      {/* Export Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Plan Details</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FilePdf className="h-4 w-4 mr-2" />
            PDF
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-sm text-red-600">{submitError}</p>
        </div>
      )}

      {submitSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          <p className="text-sm text-green-600">{submitSuccess}</p>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Strategic Objective
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weight
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Initiative
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance Measures
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Main Activities
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedObjectives.map((objective, objIndex) => {
                const effectiveWeight = objective.effective_weight || objective.planner_weight || objective.weight;
                
                return (
                  <React.Fragment key={objective.id}>
                    {/* Objective Row */}
                    <tr className="bg-blue-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Target className="h-5 w-5 text-blue-600 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{objective.title}</div>
                            <div className="text-sm text-gray-500">{objective.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {effectiveWeight.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {objective.initiatives?.length || 0} initiatives
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {objective.initiatives?.reduce((total, init) => 
                          total + (init.performance_measures?.length || 0), 0) || 0} measures
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {objective.initiatives?.reduce((total, init) => 
                          total + (init.main_activities?.length || 0), 0) || 0} activities
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatCurrency(
                          objective.initiatives?.reduce((total, init) => 
                            total + (init.main_activities?.reduce((sum, act) => {
                              if (!act.budget) return sum;
                              const cost = act.budget.budget_calculation_type === 'WITH_TOOL' 
                                ? Number(act.budget.estimated_cost_with_tool || 0)
                                : Number(act.budget.estimated_cost_without_tool || 0);
                              return sum + cost;
                            }, 0) || 0), 0) || 0
                        )}
                      </td>
                    </tr>

                    {/* Initiative Rows */}
                    {objective.initiatives?.map((initiative, initIndex) => (
                      <React.Fragment key={`${objective.id}-${initiative.id}`}>
                        <tr className="bg-green-50">
                          <td className="px-6 py-4 whitespace-nowrap pl-12">
                            <div className="flex items-center">
                              <Activity className="h-4 w-4 text-green-600 mr-2" />
                              <span className="text-sm font-medium text-gray-900">{initiative.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {initiative.weight}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {initiative.organization_name || organizationsMap[initiative.organization] || 'Ministry of Health'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {initiative.performance_measures?.length || 0} measures
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {initiative.main_activities?.length || 0} activities
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatCurrency(
                              initiative.main_activities?.reduce((sum, act) => {
                                if (!act.budget) return sum;
                                const cost = act.budget.budget_calculation_type === 'WITH_TOOL' 
                                  ? Number(act.budget.estimated_cost_with_tool || 0)
                                  : Number(act.budget.estimated_cost_without_tool || 0);
                                return sum + cost;
                              }, 0) || 0
                            )}
                          </td>
                        </tr>

                        {/* Performance Measures */}
                        {initiative.performance_measures?.map((measure, measureIndex) => (
                          <tr key={`${objective.id}-${initiative.id}-measure-${measure.id}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap pl-16">
                              <span className="text-sm text-gray-900">{measure.name}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-500">{measure.weight}%</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">Performance Measure</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{measure.baseline || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              Q1: {measure.q1_target} | Q2: {measure.q2_target} | Q3: {measure.q3_target} | Q4: {measure.q4_target}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">-</td>
                          </tr>
                        ))}

                        {/* Main Activities */}
                        {initiative.main_activities?.map((activity, actIndex) => {
                          const budgetRequired = activity.budget 
                            ? (activity.budget.budget_calculation_type === 'WITH_TOOL' 
                                ? Number(activity.budget.estimated_cost_with_tool || 0)
                                : Number(activity.budget.estimated_cost_without_tool || 0))
                            : 0;

                          const government = Number(activity.budget?.government_treasury || 0);
                          const partners = Number(activity.budget?.partners_funding || 0);
                          const sdg = Number(activity.budget?.sdg_funding || 0);
                          const other = Number(activity.budget?.other_funding || 0);
                          const totalAvailable = government + partners + sdg + other;
                          const gap = Math.max(0, budgetRequired - totalAvailable);

                          return (
                            <tr key={`${objective.id}-${initiative.id}-activity-${activity.id}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap pl-16">
                                <span className="text-sm text-gray-900">{activity.name}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500">{activity.weight}%</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">Main Activity</td>
                              <td className="px-6 py-4 text-sm text-gray-500">{activity.baseline || '-'}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                Q1: {activity.q1_target} | Q2: {activity.q2_target} | Q3: {activity.q3_target} | Q4: {activity.q4_target}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {activity.budget ? (
                                  <div className="space-y-1">
                                    <div className="font-medium">{formatCurrency(budgetRequired)}</div>
                                    <div className="text-xs text-gray-500">
                                      Gov: {formatCurrency(government)} | Partners: {formatCurrency(partners)}
                                    </div>
                                    {gap > 0 && (
                                      <div className="text-xs text-red-600">Gap: {formatCurrency(gap)}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">No budget</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget Summary */}
      {totals.totalRequired > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-green-600" />
            Budget Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Required</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(totals.totalRequired)}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Available</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(totals.totalAvailable)}</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Government</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(totals.totalGovernment)}</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Partners</div>
              <div className="text-xl font-bold text-purple-600">{formatCurrency(totals.totalPartners)}</div>
            </div>
          </div>
          
          {totals.totalGap > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm font-medium text-red-700">
                  Funding Gap: {formatCurrency(totals.totalGap)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit Button - Only show if not preview mode and not view only */}
      {!isPreviewMode && !isViewOnly && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmitPlan}
            disabled={isSubmitting || isSubmittingPlan}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isSubmitting || isSubmittingPlan ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Submitting...
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