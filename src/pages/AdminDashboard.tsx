import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  Building2, 
  DollarSign, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertCircle,
  Loader,
  RefreshCw,
  PieChart,
  Activity
} from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { plans, organizations, auth } from '../lib/api';
import { isAdmin } from '../types/user';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  const [budgetData, setBudgetData] = useState<any>({
    labels: [],
    datasets: []
  });
  const [planStatusData, setPlanStatusData] = useState<any>({
    labels: [],
    datasets: []
  });

  // Check admin permissions
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const authData = await auth.getCurrentUser();
        if (!authData.isAuthenticated) {
          navigate('/login');
          return;
        }
        
        if (!isAdmin(authData.userOrganizations)) {
          setError('You do not have permission to access the admin dashboard');
        }
      } catch (error) {
        console.error('Failed to check permissions:', error);
        setError('Failed to verify your permissions');
      }
    };
    
    checkPermissions();
  }, [navigate]);

  // Fetch organizations with optimized query
  const { data: organizationsData } = useQuery({
    queryKey: ['organizations', 'admin'],
    queryFn: async () => {
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
        return response || [];
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // Fetch all plans with budget data - optimized for performance
  const { data: plansData, isLoading, refetch } = useQuery({
    queryKey: ['plans', 'admin-all'],
    queryFn: async () => {
      try {
        console.log('Admin: Fetching all plans with budget data...');
        const response = await plans.getAll();
        const allPlans = response?.data || [];
        
        console.log(`Admin: Processing ${allPlans.length} plans for budget analysis`);
        
        // Process plans to calculate budget totals efficiently
        const processedPlans = allPlans.map(plan => {
          let totalBudgetRequired = 0;
          let totalGovernment = 0;
          let totalPartners = 0;
          let totalSDG = 0;
          let totalOther = 0;
          
          // Calculate budget from plan objectives
          if (plan.objectives && Array.isArray(plan.objectives)) {
            plan.objectives.forEach((objective: any) => {
              if (objective.initiatives && Array.isArray(objective.initiatives)) {
                objective.initiatives.forEach((initiative: any) => {
                  if (initiative.main_activities && Array.isArray(initiative.main_activities)) {
                    initiative.main_activities.forEach((activity: any) => {
                      // Calculate budget from sub-activities (new structure)
                      if (activity.sub_activities && Array.isArray(activity.sub_activities) && activity.sub_activities.length > 0) {
                        activity.sub_activities.forEach((subActivity: any) => {
                          // Use direct SubActivity model fields
                          const subBudgetRequired = subActivity.budget_calculation_type === 'WITH_TOOL'
                            ? Number(subActivity.estimated_cost_with_tool || 0)
                            : Number(subActivity.estimated_cost_without_tool || 0);
                          
                          totalBudgetRequired += subBudgetRequired;
                          totalGovernment += Number(subActivity.government_treasury || 0);
                          totalPartners += Number(subActivity.partners_funding || 0);
                          totalSDG += Number(subActivity.sdg_funding || 0);
                          totalOther += Number(subActivity.other_funding || 0);
                        });
                      } else if (activity.budget) {
                        // Use legacy budget if no sub-activities
                        const activityBudgetRequired = activity.budget.budget_calculation_type === 'WITH_TOOL'
                          ? Number(activity.budget.estimated_cost_with_tool || 0)
                          : Number(activity.budget.estimated_cost_without_tool || 0);
                        
                        totalBudgetRequired += activityBudgetRequired;
                        totalGovernment += Number(activity.budget.government_treasury || 0);
                        totalPartners += Number(activity.budget.partners_funding || 0);
                        totalSDG += Number(activity.budget.sdg_funding || 0);
                        totalOther += Number(activity.budget.other_funding || 0);
                      }
                    });
                  }
                });
              }
            });
          }
          
          const totalAvailable = totalGovernment + totalPartners + totalSDG + totalOther;
          const fundingGap = Math.max(0, totalBudgetRequired - totalAvailable);
          
          return {
            ...plan,
            organizationName: organizationsMap[plan.organization] || 'Unknown Organization',
            totalBudgetRequired,
            totalGovernment,
            totalPartners,
            totalSDG,
            totalOther,
            totalAvailable,
            fundingGap
          };
        });
        
        console.log('Admin: Plans processed with budget data');
        return processedPlans;
      } catch (error) {
        console.error('Error fetching plans:', error);
        throw error;
      }
    },
    enabled: !!organizationsData && Object.keys(organizationsMap).length > 0,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 1
  });

  // Calculate summary statistics - optimized
  const summaryStats = React.useMemo(() => {
    if (!plansData || !Array.isArray(plansData)) {
      return {
        totalPlans: 0,
        submittedPlans: 0,
        approvedPlans: 0,
        rejectedPlans: 0,
        draftPlans: 0,
        totalBudget: 0,
        totalFunding: 0,
        totalGap: 0,
        organizationCount: 0
      };
    }

    const totalPlans = plansData.length;
    const submittedPlans = plansData.filter(p => p.status === 'SUBMITTED').length;
    const approvedPlans = plansData.filter(p => p.status === 'APPROVED').length;
    const rejectedPlans = plansData.filter(p => p.status === 'REJECTED').length;
    const draftPlans = plansData.filter(p => p.status === 'DRAFT').length;
    
    const totalBudget = plansData.reduce((sum, plan) => sum + (plan.totalBudgetRequired || 0), 0);
    const totalFunding = plansData.reduce((sum, plan) => sum + (plan.totalAvailable || 0), 0);
    const totalGap = plansData.reduce((sum, plan) => sum + (plan.fundingGap || 0), 0);
    
    const uniqueOrganizations = new Set(plansData.map(p => p.organization));
    
    return {
      totalPlans,
      submittedPlans,
      approvedPlans,
      rejectedPlans,
      draftPlans,
      totalBudget,
      totalFunding,
      totalGap,
      organizationCount: uniqueOrganizations.size
    };
  }, [plansData]);

  // Setup chart data - optimized
  useEffect(() => {
    if (plansData && Array.isArray(plansData)) {
      // Budget by organization chart
      const orgBudgets = plansData.reduce((acc: any, plan: any) => {
        const orgName = plan.organizationName || 'Unknown';
        if (!acc[orgName]) {
          acc[orgName] = { budget: 0, funding: 0 };
        }
        acc[orgName].budget += plan.totalBudgetRequired || 0;
        acc[orgName].funding += plan.totalAvailable || 0;
        return acc;
      }, {});

      setBudgetData({
        labels: Object.keys(orgBudgets),
        datasets: [
          {
            label: 'Budget Required',
            data: Object.values(orgBudgets).map((org: any) => org.budget),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1
          },
          {
            label: 'Funding Available',
            data: Object.values(orgBudgets).map((org: any) => org.funding),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1
          }
        ]
      });

      // Plan status chart
      setPlanStatusData({
        labels: ['Draft', 'Submitted', 'Approved', 'Rejected'],
        datasets: [{
          data: [summaryStats.draftPlans, summaryStats.submittedPlans, summaryStats.approvedPlans, summaryStats.rejectedPlans],
          backgroundColor: [
            'rgba(156, 163, 175, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            'rgba(156, 163, 175, 1)',
            'rgba(251, 191, 36, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(239, 68, 68, 1)'
          ],
          borderWidth: 1
        }]
      });
    }
  }, [plansData, summaryStats]);

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not available';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return 'Invalid date';
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-6 w-6 animate-spin mr-2 text-green-600" />
        <span className="text-lg">Loading admin dashboard...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">System overview and analytics</p>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Total Plans</h3>
            <Activity className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-3xl font-semibold text-blue-600">{summaryStats.totalPlans}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Organizations</h3>
            <Building2 className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-semibold text-green-600">{summaryStats.organizationCount}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Total Budget</h3>
            <DollarSign className="h-5 w-5 text-purple-500" />
          </div>
          <p className="text-3xl font-semibold text-purple-600">{formatCurrency(summaryStats.totalBudget)}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Funding Gap</h3>
            <TrendingUp className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-3xl font-semibold text-red-600">{formatCurrency(summaryStats.totalGap)}</p>
        </div>
      </div>

      {/* Plan Status Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Draft Plans</h3>
            <Clock className="h-5 w-5 text-gray-500" />
          </div>
          <p className="text-3xl font-semibold text-gray-600">{summaryStats.draftPlans}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Submitted</h3>
            <Clock className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-semibold text-yellow-600">{summaryStats.submittedPlans}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Approved</h3>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-semibold text-green-600">{summaryStats.approvedPlans}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Rejected</h3>
            <XCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-3xl font-semibold text-red-600">{summaryStats.rejectedPlans}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Budget Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
            Budget by Organization
          </h3>
          {budgetData.labels.length > 0 ? (
            <div style={{ height: '300px' }}>
              <Bar 
                data={budgetData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                    },
                    title: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return '$' + Number(value).toLocaleString();
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No budget data available</p>
            </div>
          )}
        </div>

        {/* Plan Status Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <PieChart className="h-5 w-5 mr-2 text-green-600" />
            Plan Status Distribution
          </h3>
          {planStatusData.labels.length > 0 ? (
            <div style={{ height: '300px' }}>
              <Doughnut 
                data={planStatusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const,
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              <PieChart className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No plan status data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Budget Summary Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Budget Summary by Organization</h3>
              <p className="mt-1 text-sm text-gray-500">
                Overview of budget requirements and funding by organization
              </p>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <button
                onClick={() => refetch()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>

          {!plansData || plansData.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mt-6">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Plans Available</h3>
              <p className="text-gray-500">No plans have been created yet.</p>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Budget Required
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Available Funding
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Funding Gap
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {plansData.map((plan: any) => (
                    <tr key={plan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {plan.organizationName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {plan.type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          plan.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          plan.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
                          plan.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {plan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(plan.totalBudgetRequired || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-medium">
                        {formatCurrency(plan.totalAvailable || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                        {plan.fundingGap > 0 ? (
                          <span className="text-red-600">{formatCurrency(plan.fundingGap)}</span>
                        ) : (
                          <span className="text-green-600">Fully Funded</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(plan.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Funding Source Breakdown */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-green-600" />
          System-wide Budget Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Required</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(summaryStats.totalBudget)}</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Available</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(summaryStats.totalFunding)}</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Government</div>
            <div className="text-xl font-bold text-blue-600">
              {formatCurrency(plansData?.reduce((sum: number, plan: any) => sum + (plan.totalGovernment || 0), 0) || 0)}
            </div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Partners</div>
            <div className="text-xl font-bold text-purple-600">
              {formatCurrency(plansData?.reduce((sum: number, plan: any) => sum + (plan.totalPartners || 0), 0) || 0)}
            </div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">SDG</div>
            <div className="text-xl font-bold text-orange-600">
              {formatCurrency(plansData?.reduce((sum: number, plan: any) => sum + (plan.totalSDG || 0), 0) || 0)}
            </div>
          </div>
        </div>
        
        {summaryStats.totalGap > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-sm font-medium text-red-700">
                System-wide Funding Gap: {formatCurrency(summaryStats.totalGap)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;