import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart3, PieChart, DollarSign, Building2, Users, FileText, TrendingUp, AlertCircle, Loader, RefreshCw, Eye, Calendar, CheckCircle, XCircle, Clock, GraduationCap, Briefcase, Shield, ShoppingCart, Printer, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { plans, organizations, auth } from '../lib/api';
import { format } from 'date-fns';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { isAdmin } from '../types/user';

// Simple translation function to avoid LanguageContext issues
const t = (key: string) => key;

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewedCurrentPage, setReviewedCurrentPage] = useState(1);
  const [activityCurrentPage, setActivityCurrentPage] = useState(1);
  const plansPerPage = 5;
  const activityEntriesPerPage = 10;

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

  // Fetch organizations for mapping
  const { data: organizationsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizations.getAll(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Fetch all plans for analytics
  const { data: allPlans, isLoading, refetch } = useQuery({
    queryKey: ['plans', 'admin-all'],
    queryFn: () => plans.getAll(),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2
  });

  // Create organizations mapping
  useEffect(() => {
    if (organizationsData) {
      const orgMap: Record<string, string> = {};
      const orgsArray = Array.isArray(organizationsData) ? organizationsData : organizationsData.data || [];
      
      if (Array.isArray(orgsArray)) {
        orgsArray.forEach((org: any) => {
          if (org && org.id) {
            orgMap[org.id] = org.name;
          }
        });
      }
      
      setOrganizationsMap(orgMap);
    }
  }, [organizationsData]);

  // Calculate comprehensive statistics
  const calculateStats = () => {
    if (!allPlans?.data) {
      return {
        totalPlans: 0,
        draftPlans: 0,
        submittedPlans: 0,
        approvedPlans: 0,
        rejectedPlans: 0,
        totalBudget: 0,
        organizationStats: [],
        activityStats: {
          Training: { count: 0, budget: 0 },
          Meeting: { count: 0, budget: 0 },
          Workshop: { count: 0, budget: 0 },
          Supervision: { count: 0, budget: 0 },
          Procurement: { count: 0, budget: 0 },
          Printing: { count: 0, budget: 0 },
          Other: { count: 0, budget: 0 }
        },
        activityBreakdown: []
      };
    }

    const plans = allPlans.data.results || allPlans.data || [];
    const orgStats: Record<string, any> = {};
    const globalActivityStats = {
      Training: { count: 0, budget: 0 },
      Meeting: { count: 0, budget: 0 },
      Workshop: { count: 0, budget: 0 },
      Supervision: { count: 0, budget: 0 },
      Procurement: { count: 0, budget: 0 },
      Printing: { count: 0, budget: 0 },
      Other: { count: 0, budget: 0 }
    };
    const activityBreakdown: any[] = [];

    let totalBudget = 0;

    plans.forEach((plan: any) => {
      const orgId = plan.organization;
      const orgName = organizationsMap[orgId] || `Organization ${orgId}`;
      
      if (!orgStats[orgId]) {
        orgStats[orgId] = {
          id: orgId,
          name: orgName,
          totalBudget: 0,
          planCount: 0,
          activities: {
            Training: { count: 0, budget: 0 },
            Meeting: { count: 0, budget: 0 },
            Workshop: { count: 0, budget: 0 },
            Supervision: { count: 0, budget: 0 },
            Procurement: { count: 0, budget: 0 },
            Printing: { count: 0, budget: 0 },
            Other: { count: 0, budget: 0 }
          }
        };
      }

      orgStats[orgId].planCount++;

      // Process budget data from multiple possible sources
      const objectivesData = plan.objectives || plan.selected_objectives_data || plan.objectives_data || [];
      
      if (Array.isArray(objectivesData)) {
        objectivesData.forEach((objective: any) => {
          const initiatives = objective.initiatives || [];
          
          initiatives.forEach((initiative: any) => {
            const activities = initiative.main_activities || [];
            
            activities.forEach((activity: any) => {
              if (activity.budget) {
                const budget = activity.budget;
                const cost = budget.budget_calculation_type === 'WITH_TOOL' 
                  ? Number(budget.estimated_cost_with_tool || 0) 
                  : Number(budget.estimated_cost_without_tool || 0);
                
                const activityType = budget.activity_type || 'Other';
                
                // Update organization stats
                if (orgStats[orgId].activities[activityType]) {
                  orgStats[orgId].activities[activityType].count++;
                  orgStats[orgId].activities[activityType].budget += cost;
                }
                
                // Update global stats
                if (globalActivityStats[activityType]) {
                  globalActivityStats[activityType].count++;
                  globalActivityStats[activityType].budget += cost;
                }
                
                // Add to activity breakdown
                activityBreakdown.push({
                  organizationId: orgId,
                  organizationName: orgName,
                  activityType: activityType,
                  activityName: activity.name,
                  budget: cost,
                  planId: plan.id
                });
                
                orgStats[orgId].totalBudget += cost;
                totalBudget += cost;
              }
            });
          });
        });
      }
    });

    // Filter organizations that have budget data
    const organizationStatsArray = Object.values(orgStats).filter((org: any) => 
      ['SUBMITTED', 'APPROVED'].includes(plans.find((p: any) => p.organization === org.id)?.status)
    );

    return {
      totalPlans: plans.length,
      draftPlans: plans.filter((p: any) => p.status === 'DRAFT').length,
      submittedPlans: plans.filter((p: any) => p.status === 'SUBMITTED').length,
      approvedPlans: plans.filter((p: any) => p.status === 'APPROVED').length,
      rejectedPlans: plans.filter((p: any) => p.status === 'REJECTED').length,
      totalBudget,
      organizationStats: organizationStatsArray,
      activityStats: globalActivityStats,
      activityBreakdown
    };
  };

  const stats = calculateStats();

  // Aggregate activity breakdown by organization and activity type
  const aggregatedActivityData = React.useMemo(() => {
    const aggregated: Record<string, any> = {};
    
    stats.activityBreakdown.forEach((item: any) => {
      const key = `${item.organizationId}-${item.activityType}`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          organizationId: item.organizationId,
          organizationName: item.organizationName,
          activityType: item.activityType,
          count: 0,
          totalBudget: 0
        };
      }
      
      aggregated[key].count++;
      aggregated[key].totalBudget += item.budget;
    });
    
    return Object.values(aggregated).sort((a: any, b: any) => {
      if (a.organizationName !== b.organizationName) {
        return a.organizationName.localeCompare(b.organizationName);
      }
      return a.activityType.localeCompare(b.activityType);
    });
  }, [stats.activityBreakdown]);

  // Pagination for activity breakdown
  const totalActivityPages = Math.ceil(aggregatedActivityData.length / activityEntriesPerPage);
  const startActivityIndex = (activityCurrentPage - 1) * activityEntriesPerPage;
  const endActivityIndex = startActivityIndex + activityEntriesPerPage;
  const currentActivityData = aggregatedActivityData.slice(startActivityIndex, endActivityIndex);

  // Pagination for all plans
  const allPlansData = allPlans?.data?.results || allPlans?.data || [];
  const totalPages = Math.ceil(allPlansData.length / plansPerPage);
  const startIndex = (currentPage - 1) * plansPerPage;
  const endIndex = startIndex + plansPerPage;
  const currentPlans = allPlansData.slice(startIndex, endIndex);

  // Pagination for reviewed plans
  const reviewedPlans = allPlansData.filter((plan: any) => ['APPROVED', 'REJECTED'].includes(plan.status));
  const totalReviewedPages = Math.ceil(reviewedPlans.length / plansPerPage);
  const reviewedStartIndex = (reviewedCurrentPage - 1) * plansPerPage;
  const reviewedEndIndex = reviewedStartIndex + plansPerPage;
  const currentReviewedPlans = reviewedPlans.slice(reviewedStartIndex, reviewedEndIndex);

  // Chart data for budget by organization
  const budgetChartData = {
    labels: stats.organizationStats.map((org: any) => org.name),
    datasets: [
      {
        label: 'Total Budget (ETB)',
        data: stats.organizationStats.map((org: any) => org.totalBudget),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  // Chart data for plan status distribution
  const statusChartData = {
    labels: ['Draft', 'Submitted', 'Approved', 'Rejected'],
    datasets: [
      {
        data: [stats.draftPlans, stats.submittedPlans, stats.approvedPlans, stats.rejectedPlans],
        backgroundColor: [
          'rgba(156, 163, 175, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(156, 163, 175, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'Training': return <GraduationCap className="h-5 w-5 text-green-600" />;
      case 'Meeting': return <Users className="h-5 w-5 text-blue-600" />;
      case 'Workshop': return <Briefcase className="h-5 w-5 text-purple-600" />;
      case 'Supervision': return <Shield className="h-5 w-5 text-orange-600" />;
      case 'Procurement': return <ShoppingCart className="h-5 w-5 text-indigo-600" />;
      case 'Printing': return <Printer className="h-5 w-5 text-pink-600" />;
      default: return <Zap className="h-5 w-5 text-gray-600" />;
    }
  };

  const getActivityColor = (activityType: string) => {
    switch (activityType) {
      case 'Training': return 'bg-green-100 text-green-800';
      case 'Meeting': return 'bg-blue-100 text-blue-800';
      case 'Workshop': return 'bg-purple-100 text-purple-800';
      case 'Supervision': return 'bg-orange-100 text-orange-800';
      case 'Procurement': return 'bg-indigo-100 text-indigo-800';
      case 'Printing': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  const formatCurrency = (value: number): string => {
    return `ETB ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleViewPlan = (planId: string) => {
    navigate(`/plans/${planId}`);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="p-8 bg-red-50 border border-red-200 rounded-xl text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-8 w-8 animate-spin mr-3 text-blue-600" />
        <span className="text-xl">Loading admin dashboard...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Admin Analytics Dashboard</h1>
        <p className="text-blue-100">Comprehensive overview of organizational planning and budget performance</p>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Plans</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPlans}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Budget</p>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.totalBudget)}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Organizations</p>
              <p className="text-3xl font-bold text-purple-600">{stats.organizationStats.length}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Building2 className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Approved Plans</p>
              <p className="text-3xl font-bold text-emerald-600">{stats.approvedPlans}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-full">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Budget Statistics */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
        <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-bold text-white mb-2">Budget by Activity Type</h2>
          <p className="text-green-100">Overview of budget allocation across different activity types</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {Object.entries(stats.activityStats).map(([activityType, data]: [string, any]) => (
            <div key={activityType} className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-white p-2 rounded-full shadow-sm">
                  {getActivityIcon(activityType)}
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActivityColor(activityType)}`}>
                  {data.count}
                </span>
              </div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">{activityType}</h3>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(data.budget)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Budget Activity Breakdown Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6">
          <h2 className="text-xl font-bold text-white mb-2">Budget by Activity Type</h2>
          <p className="text-purple-100">Detailed breakdown of budget allocation by organization and activity type</p>
          <div className="mt-3 text-sm text-purple-100">
            Showing {aggregatedActivityData.length} activity entries across all organizations
          </div>
        </div>
        
        <div className="p-6">
          {aggregatedActivityData.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Activity Budget Data</h3>
              <p className="text-gray-500">No budget data available for activity breakdown</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Organization
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Activity Type
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Count
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Total Budget
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentActivityData.map((item: any, index: number) => (
                      <tr key={`${item.organizationId}-${item.activityType}`} 
                          className="hover:bg-gradient-to-r hover:from-purple-25 hover:to-pink-25 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-purple-100 p-2 rounded-full mr-3">
                              <Building2 className="h-4 w-4 text-purple-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{item.organizationName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-white p-2 rounded-full mr-3 shadow-sm">
                              {getActivityIcon(item.activityType)}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getActivityColor(item.activityType)}`}>
                              {item.activityType}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="text-lg font-bold text-gray-900">{item.count}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-lg font-bold text-green-600">{formatCurrency(item.totalBudget)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Activity Breakdown Pagination */}
              {totalActivityPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing {startActivityIndex + 1} to {Math.min(endActivityIndex, aggregatedActivityData.length)} of {aggregatedActivityData.length} activity entries
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setActivityCurrentPage(Math.max(1, activityCurrentPage - 1))}
                      disabled={activityCurrentPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-md">
                      Page {activityCurrentPage} of {totalActivityPages}
                    </span>
                    
                    <button
                      onClick={() => setActivityCurrentPage(Math.min(totalActivityPages, activityCurrentPage + 1))}
                      disabled={activityCurrentPage === totalActivityPages}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Budget by Organization Chart */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold text-white mb-2">Budget by Organization</h2>
            <p className="text-green-100">Budget allocation across all organizations</p>
          </div>
          
          {stats.organizationStats.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Budget Data</h3>
              <p className="text-gray-500">No organizations have submitted plans with budget information yet</p>
            </div>
          ) : (
            <div style={{ height: '400px' }}>
              <Bar
                data={budgetChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => `Budget: ${formatCurrency(context.parsed.y)}`,
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                      },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => formatCurrency(Number(value)),
                      },
                    },
                  },
                }}
              />
            </div>
          )}
        </div>

        {/* Plan Status Distribution */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold text-white mb-2">Plan Status Distribution</h2>
            <p className="text-blue-100">Overview of plan statuses across the system</p>
          </div>
          
          <div style={{ height: '400px' }}>
            <Doughnut
              data={statusChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      padding: 20,
                      usePointStyle: true,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${context.label}: ${context.parsed} plans`,
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Organization Performance Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6">
          <h2 className="text-xl font-bold text-white mb-2">Organization Performance</h2>
          <p className="text-emerald-100">Budget and planning performance by organization</p>
          <div className="mt-3 text-sm text-emerald-100">
            {stats.organizationStats.length} organizations with budget data
          </div>
        </div>
        
        <div className="p-6">
          {stats.organizationStats.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Organization Data</h3>
              <p className="text-gray-500">No organizations have submitted plans with budget information yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-emerald-50 to-teal-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Plans
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Total Budget
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Activities
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.organizationStats.map((org: any) => (
                    <tr key={org.id} className="hover:bg-gradient-to-r hover:from-emerald-25 hover:to-teal-25 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="bg-emerald-100 p-2 rounded-full mr-3">
                            <Building2 className="h-5 w-5 text-emerald-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{org.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-lg font-bold text-blue-600">{org.planCount}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-lg font-bold text-green-600">{formatCurrency(org.totalBudget)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {Object.entries(org.activities).map(([activityType, activityData]: [string, any]) => (
                            activityData.count > 0 && (
                              <span key={activityType} className={`px-2 py-1 rounded-full text-xs font-medium ${getActivityColor(activityType)}`}>
                                {activityType}: {activityData.count}
                              </span>
                            )
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* All Plans Overview */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6">
          <h2 className="text-xl font-bold text-white mb-2">All Plans Overview</h2>
          <p className="text-blue-100">Complete list of all plans in the system</p>
          <div className="mt-3 text-sm text-blue-100">
            {allPlansData.length} total plans
          </div>
        </div>
        
        <div className="p-6">
          {allPlansData.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Plans Found</h3>
              <p className="text-gray-500">No plans have been created yet</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-blue-50 to-cyan-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Organization
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Planner
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Plan Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentPlans.map((plan: any) => (
                      <tr key={plan.id} className="hover:bg-gradient-to-r hover:from-blue-25 hover:to-cyan-25 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-blue-100 p-2 rounded-full mr-3">
                              <Building2 className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {organizationsMap[plan.organization] || `Organization ${plan.organization}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.planner_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.from_date && plan.to_date ? 
                            `${formatDate(plan.from_date)} - ${formatDate(plan.to_date)}` : 
                            'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            plan.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                            plan.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
                            plan.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {plan.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleViewPlan(plan.id)}
                            className="text-blue-600 hover:text-blue-900 flex items-center justify-end"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* All Plans Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing {startIndex + 1} to {Math.min(endIndex, allPlansData.length)} of {allPlansData.length} plans
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-md">
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reviewed Plans Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6">
          <h2 className="text-xl font-bold text-white mb-2">Reviewed Plans</h2>
          <p className="text-indigo-100">Plans that have been approved or rejected</p>
          <div className="mt-3 text-sm text-indigo-100">
            {reviewedPlans.length} reviewed plans
          </div>
        </div>
        
        <div className="p-6">
          {reviewedPlans.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Reviewed Plans</h3>
              <p className="text-gray-500">No plans have been reviewed yet</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Organization
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Planner
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Reviewed Date
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentReviewedPlans.map((plan: any) => (
                      <tr key={plan.id} className="hover:bg-gradient-to-r hover:from-indigo-25 hover:to-purple-25 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-indigo-100 p-2 rounded-full mr-3">
                              <Building2 className="h-4 w-4 text-indigo-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {organizationsMap[plan.organization] || `Organization ${plan.organization}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.planner_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.from_date && plan.to_date ? 
                            `${formatDate(plan.from_date)} - ${formatDate(plan.to_date)}` : 
                            'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            plan.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {plan.status === 'APPROVED' ? (
                              <div className="flex items-center">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                APPROVED
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <XCircle className="h-3 w-3 mr-1" />
                                REJECTED
                              </div>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.reviews && plan.reviews.length > 0 ? 
                            formatDate(plan.reviews[plan.reviews.length - 1].reviewed_at) : 
                            formatDate(plan.updated_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleViewPlan(plan.id)}
                            className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Reviewed Plans Pagination */}
              {totalReviewedPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing {reviewedStartIndex + 1} to {Math.min(reviewedEndIndex, reviewedPlans.length)} of {reviewedPlans.length} reviewed plans
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setReviewedCurrentPage(Math.max(1, reviewedCurrentPage - 1))}
                      disabled={reviewedCurrentPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-md">
                      Page {reviewedCurrentPage} of {totalReviewedPages}
                    </span>
                    
                    <button
                      onClick={() => setReviewedCurrentPage(Math.min(totalReviewedPages, reviewedCurrentPage + 1))}
                      disabled={reviewedCurrentPage === totalReviewedPages}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;