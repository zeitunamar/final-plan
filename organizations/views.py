from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth.forms import PasswordChangeForm
from django.db.models import Sum, Q
from decimal import Decimal
import json

from .models import (
    Organization, OrganizationUser, StrategicObjective, 
    Program, StrategicInitiative, PerformanceMeasure, MainActivity,
    ActivityBudget, ActivityCostingAssumption, Plan, PlanReview, InitiativeFeed,
    Location, LandTransport, AirTransport, PerDiem, Accommodation,
    ParticipantCost, SessionCost, PrintingCost, SupervisorCost, ProcurementItem
)
from .serializers import (
    OrganizationSerializer, OrganizationUserSerializer, StrategicObjectiveSerializer,
    ProgramSerializer, StrategicInitiativeSerializer, PerformanceMeasureSerializer,
    MainActivitySerializer, ActivityBudgetSerializer, ActivityCostingAssumptionSerializer,
    PlanSerializer, PlanReviewSerializer, InitiativeFeedSerializer,
    LocationSerializer, LandTransportSerializer, AirTransportSerializer,
    PerDiemSerializer, AccommodationSerializer, ParticipantCostSerializer,
    SessionCostSerializer, PrintingCostSerializer, SupervisorCostSerializer,
    ProcurementItemSerializer
)

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

class OrganizationUserViewSet(viewsets.ModelViewSet):
    queryset = OrganizationUser.objects.all()
    serializer_class = OrganizationUserSerializer
    permission_classes = [IsAuthenticated]

class StrategicObjectiveViewSet(viewsets.ModelViewSet):
    queryset = StrategicObjective.objects.all()
    serializer_class = StrategicObjectiveSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def weight_summary(self, request):
        """Get weight summary for all strategic objectives"""
        try:
            objectives = StrategicObjective.objects.all()
            total_weight = sum(obj.get_effective_weight() for obj in objectives)
            remaining_weight = 100 - total_weight
            is_valid = abs(total_weight - 100) < 0.01
            
            return Response({
                'total_weight': total_weight,
                'remaining_weight': remaining_weight,
                'is_valid': is_valid
            })
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ProgramViewSet(viewsets.ModelViewSet):
    queryset = Program.objects.all()
    serializer_class = ProgramSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Program.objects.all()
        strategic_objective = self.request.query_params.get('strategic_objective', None)
        if strategic_objective is not None:
            queryset = queryset.filter(strategic_objective=strategic_objective)
        return queryset

class StrategicInitiativeViewSet(viewsets.ModelViewSet):
    queryset = StrategicInitiative.objects.all()
    serializer_class = StrategicInitiativeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = StrategicInitiative.objects.all()
        objective = self.request.query_params.get('objective', None)
        program = self.request.query_params.get('program', None)
        subprogram = self.request.query_params.get('subprogram', None)
        
        if objective is not None:
            queryset = queryset.filter(strategic_objective=objective)
        elif program is not None:
            queryset = queryset.filter(program=program)
        elif subprogram is not None:
            queryset = queryset.filter(subprogram=subprogram)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def weight_summary(self, request):
        """Get weight summary for initiatives based on parent (objective, program, or subprogram)"""
        try:
            objective_id = request.query_params.get('objective')
            program_id = request.query_params.get('program')
            subprogram_id = request.query_params.get('subprogram')
            
            if objective_id:
                # Get initiatives for this objective
                initiatives = StrategicInitiative.objects.filter(strategic_objective=objective_id)
                
                # Get the objective to determine parent weight
                try:
                    objective = StrategicObjective.objects.get(id=objective_id)
                    parent_weight = objective.get_effective_weight()
                except StrategicObjective.DoesNotExist:
                    return Response(
                        {'error': 'Objective not found'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                    
            elif program_id:
                # Get initiatives for this program
                initiatives = StrategicInitiative.objects.filter(program=program_id)
                
                # Get the program to determine parent weight
                try:
                    program = Program.objects.get(id=program_id)
                    parent_weight = program.strategic_objective.get_effective_weight()
                except Program.DoesNotExist:
                    return Response(
                        {'error': 'Program not found'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                    
            elif subprogram_id:
                # Get initiatives for this subprogram
                initiatives = StrategicInitiative.objects.filter(subprogram=subprogram_id)
                parent_weight = 100  # Default weight for subprograms
                
            else:
                return Response(
                    {'error': 'Must specify objective, program, or subprogram parameter'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calculate total weight of initiatives
            total_initiatives_weight = initiatives.aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')
            
            remaining_weight = parent_weight - float(total_initiatives_weight)
            
            # For objectives, weight must be exactly equal to parent weight
            # For programs, weight just needs to not exceed parent weight
            if objective_id:
                is_valid = abs(float(total_initiatives_weight) - parent_weight) < 0.01
            else:
                is_valid = float(total_initiatives_weight) <= parent_weight
            
            return Response({
                'total_initiatives_weight': float(total_initiatives_weight),
                'remaining_weight': remaining_weight,
                'parent_weight': parent_weight,
                'is_valid': is_valid
            })
            
        except Exception as e:
            import traceback
            print(f"Error in weight_summary: {str(e)}")
            print(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def validate_initiatives_weight(self, request):
        """Validate that initiatives weight matches parent weight"""
        try:
            objective_id = request.query_params.get('objective')
            program_id = request.query_params.get('program')
            subprogram_id = request.query_params.get('subprogram')
            
            if objective_id:
                initiatives = StrategicInitiative.objects.filter(strategic_objective=objective_id)
                try:
                    objective = StrategicObjective.objects.get(id=objective_id)
                    parent_weight = objective.get_effective_weight()
                    parent_name = objective.title
                except StrategicObjective.DoesNotExist:
                    return Response(
                        {'error': 'Objective not found'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
            elif program_id:
                initiatives = StrategicInitiative.objects.filter(program=program_id)
                try:
                    program = Program.objects.get(id=program_id)
                    parent_weight = program.strategic_objective.get_effective_weight()
                    parent_name = program.name
                except Program.DoesNotExist:
                    return Response(
                        {'error': 'Program not found'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                return Response(
                    {'error': 'Must specify objective or program parameter'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            total_weight = initiatives.aggregate(total=Sum('weight'))['total'] or Decimal('0')
            
            if objective_id:
                # For objectives, weight must be exactly equal
                if abs(float(total_weight) - parent_weight) < 0.01:
                    return Response({
                        'message': f'Initiatives weight is valid ({float(total_weight)}% = {parent_weight}%)',
                        'is_valid': True
                    })
                else:
                    return Response({
                        'message': f'Initiatives weight ({float(total_weight)}%) must equal {parent_name} weight ({parent_weight}%)',
                        'is_valid': False
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # For programs, weight just needs to not exceed
                if float(total_weight) <= parent_weight:
                    return Response({
                        'message': f'Initiatives weight is valid ({float(total_weight)}% ≤ {parent_weight}%)',
                        'is_valid': True
                    })
                else:
                    return Response({
                        'message': f'Initiatives weight ({float(total_weight)}%) exceeds {parent_name} weight ({parent_weight}%)',
                        'is_valid': False
                    }, status=status.HTTP_400_BAD_REQUEST)
                    
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def weight_summary(self, request):
        """Get weight summary for initiatives based on parent (objective, program, or subprogram)"""
        try:
            objective_id = request.query_params.get('objective')
            program_id = request.query_params.get('program')
            subprogram_id = request.query_params.get('subprogram')
            
            if objective_id:
                # Get initiatives for this objective
                initiatives = StrategicInitiative.objects.filter(strategic_objective=objective_id)
                
                # Get the objective to determine parent weight
                try:
                    objective = StrategicObjective.objects.get(id=objective_id)
                    parent_weight = objective.get_effective_weight()
                except StrategicObjective.DoesNotExist:
                    return Response(
                        {'error': 'Objective not found'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                    
            elif program_id:
                # Get initiatives for this program
                initiatives = StrategicInitiative.objects.filter(program=program_id)
                
                # Get the program to determine parent weight
                try:
                    program = Program.objects.get(id=program_id)
                    parent_weight = program.strategic_objective.get_effective_weight()
                except Program.DoesNotExist:
                    return Response(
                        {'error': 'Program not found'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                    
            elif subprogram_id:
                # Get initiatives for this subprogram
                initiatives = StrategicInitiative.objects.filter(subprogram=subprogram_id)
                parent_weight = 100  # Default weight for subprograms
                
            else:
                return Response(
                    {'error': 'Must specify objective, program, or subprogram parameter'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calculate total weight of initiatives
            total_initiatives_weight = initiatives.aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')
            
            remaining_weight = parent_weight - float(total_initiatives_weight)
            
            # For objectives, weight must be exactly equal to parent weight
            # For programs, weight just needs to not exceed parent weight
            if objective_id:
                is_valid = abs(float(total_initiatives_weight) - parent_weight) < 0.01
            else:
                is_valid = float(total_initiatives_weight) <= parent_weight
            
            return Response({
                'total_initiatives_weight': float(total_initiatives_weight),
                'remaining_weight': remaining_weight,
                'parent_weight': parent_weight,
                'is_valid': is_valid
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class PerformanceMeasureViewSet(viewsets.ModelViewSet):
    queryset = PerformanceMeasure.objects.all()
    serializer_class = PerformanceMeasureSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = PerformanceMeasure.objects.all()
        initiative = self.request.query_params.get('initiative', None)
        if initiative is not None:
            queryset = queryset.filter(initiative=initiative)
        return queryset
    
    @action(detail=False, methods=['get'])
    def weight_summary(self, request):
        """Get weight summary for performance measures based on initiative"""
        try:
            initiative_id = request.query_params.get('initiative')
            
            if not initiative_id:
                return Response(
                    {'error': 'Must specify initiative parameter'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get performance measures for this initiative
            measures = PerformanceMeasure.objects.filter(initiative=initiative_id)
            
            # Get the initiative to determine parent weight
            try:
                initiative = StrategicInitiative.objects.get(id=initiative_id)
                initiative_weight = float(initiative.weight)
                expected_measures_weight = initiative_weight * 0.35  # 35% of initiative weight
            except StrategicInitiative.DoesNotExist:
                return Response(
                    {'error': 'Initiative not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Calculate total weight of measures
            total_measures_weight = measures.aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')
            
            remaining_weight = expected_measures_weight - float(total_measures_weight)
            
            # Check if weight is valid (within 0.01% tolerance)
            is_valid = abs(float(total_measures_weight) - expected_measures_weight) < 0.01
            
            return Response({
                'total_measures_weight': float(total_measures_weight),
                'expected_measures_weight': expected_measures_weight,
                'remaining_weight': remaining_weight,
                'initiative_weight': initiative_weight,
                'is_valid': is_valid
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def validate_measures_weight(self, request):
        """Validate that performance measures weight equals 35% of initiative weight"""
        try:
            initiative_id = request.query_params.get('initiative')
            
            if not initiative_id:
                return Response(
                    {'error': 'Must specify initiative parameter'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            measures = PerformanceMeasure.objects.filter(initiative=initiative_id)
            
            try:
                initiative = StrategicInitiative.objects.get(id=initiative_id)
                initiative_weight = float(initiative.weight)
                expected_weight = initiative_weight * 0.35
            except StrategicInitiative.DoesNotExist:
                return Response(
                    {'error': 'Initiative not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            total_weight = measures.aggregate(total=Sum('weight'))['total'] or Decimal('0')
            
            if abs(float(total_weight) - expected_weight) < 0.01:
                return Response({
                    'message': f'Performance measures weight is valid ({float(total_weight)}% = {expected_weight}%)',
                    'is_valid': True
                })
            else:
                return Response({
                    'message': f'Performance measures weight ({float(total_weight)}%) must equal 35% of initiative weight ({expected_weight}%)',
                    'is_valid': False
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MainActivityViewSet(viewsets.ModelViewSet):
    queryset = MainActivity.objects.all()
    serializer_class = MainActivitySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = MainActivity.objects.all()
        initiative = self.request.query_params.get('initiative', None)
        if initiative is not None:
            queryset = queryset.filter(initiative=initiative)
        return queryset
    
    @action(detail=False, methods=['get'])
    def weight_summary(self, request):
        """Get weight summary for main activities based on initiative"""
        try:
            initiative_id = request.query_params.get('initiative')
            
            if not initiative_id:
                return Response(
                    {'error': 'Must specify initiative parameter'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get main activities for this initiative
            activities = MainActivity.objects.filter(initiative=initiative_id)
            
            # Get the initiative to determine parent weight
            try:
                initiative = StrategicInitiative.objects.get(id=initiative_id)
                initiative_weight = float(initiative.weight)
                expected_activities_weight = initiative_weight * 0.65  # 65% of initiative weight
            except StrategicInitiative.DoesNotExist:
                return Response(
                    {'error': 'Initiative not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Calculate total weight of activities
            total_activities_weight = activities.aggregate(
                total=Sum('weight')
            )['total'] or Decimal('0')
            
            remaining_weight = expected_activities_weight - float(total_activities_weight)
            
            # Check if weight is valid (within 0.01% tolerance)
            is_valid = abs(float(total_activities_weight) - expected_activities_weight) < 0.01
            
            return Response({
                'total_activities_weight': float(total_activities_weight),
                'expected_activities_weight': expected_activities_weight,
                'remaining_weight': remaining_weight,
                'initiative_weight': initiative_weight,
                'is_valid': is_valid
            })
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def validate_activities_weight(self, request):
        """Validate that main activities weight equals 65% of initiative weight"""
        try:
            initiative_id = request.query_params.get('initiative')
            
            if not initiative_id:
                return Response(
                    {'error': 'Must specify initiative parameter'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            activities = MainActivity.objects.filter(initiative=initiative_id)
            
            try:
                initiative = StrategicInitiative.objects.get(id=initiative_id)
                initiative_weight = float(initiative.weight)
                expected_weight = initiative_weight * 0.65
            except StrategicInitiative.DoesNotExist:
                return Response(
                    {'error': 'Initiative not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            total_weight = activities.aggregate(total=Sum('weight'))['total'] or Decimal('0')
            
            if abs(float(total_weight) - expected_weight) < 0.01:
                return Response({
                    'message': f'Main activities weight is valid ({float(total_weight)}% = {expected_weight}%)',
                    'is_valid': True
                })
            else:
                return Response({
                    'message': f'Main activities weight ({float(total_weight)}%) must equal 65% of initiative weight ({expected_weight}%)',
                    'is_valid': False
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def update_budget(self, request, pk=None):
        """Update or create budget for a main activity"""
        try:
            activity = self.get_object()
            budget_data = request.data
            
            # Get or create the budget
            budget, created = ActivityBudget.objects.get_or_create(
                activity=activity,
                defaults=budget_data
            )
            
            if not created:
                # Update existing budget
                for key, value in budget_data.items():
                    if hasattr(budget, key):
                        setattr(budget, key, value)
                budget.save()
            
            serializer = ActivityBudgetSerializer(budget)
            return Response(serializer.data)
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ActivityBudgetViewSet(viewsets.ModelViewSet):
    queryset = ActivityBudget.objects.all()
    serializer_class = ActivityBudgetSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = ActivityBudget.objects.all()
        activity = self.request.query_params.get('activity', None)
        if activity is not None:
            queryset = queryset.filter(activity=activity)
        return queryset

class ActivityCostingAssumptionViewSet(viewsets.ModelViewSet):
    queryset = ActivityCostingAssumption.objects.all()
    serializer_class = ActivityCostingAssumptionSerializer
    permission_classes = [IsAuthenticated]

class PlanViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Plan.objects.all()
        
        # Filter by status if provided
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        # Filter by organization if provided
        organization_param = self.request.query_params.get('organization__in')
        if organization_param:
            org_ids = [int(id.strip()) for id in organization_param.split(',') if id.strip().isdigit()]
            if org_ids:
                queryset = queryset.filter(organization__in=org_ids)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit plan for review"""
        try:
            plan = self.get_object()
            
            if plan.status != 'DRAFT':
                return Response(
                    {'error': 'Only draft plans can be submitted'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            plan.status = 'SUBMITTED'
            plan.save()
            
            return Response({'message': 'Plan submitted successfully'})
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a plan"""
        try:
            plan = self.get_object()
            feedback = request.data.get('feedback', '')
            
            if plan.status != 'SUBMITTED':
                return Response(
                    {'error': 'Only submitted plans can be approved'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create review record
            PlanReview.objects.create(
                plan=plan,
                status='APPROVED',
                feedback=feedback
            )
            
            # Update plan status
            plan.status = 'APPROVED'
            plan.save()
            
            return Response({'message': 'Plan approved successfully'})
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a plan"""
        try:
            plan = self.get_object()
            feedback = request.data.get('feedback', '')
            
            if plan.status != 'SUBMITTED':
                return Response(
                    {'error': 'Only submitted plans can be rejected'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create review record
            PlanReview.objects.create(
                plan=plan,
                status='REJECTED',
                feedback=feedback
            )
            
            # Update plan status
            plan.status = 'REJECTED'
            plan.save()
            
            return Response({'message': 'Plan rejected successfully'})
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class PlanReviewViewSet(viewsets.ModelViewSet):
    queryset = PlanReview.objects.all()
    serializer_class = PlanReviewSerializer
    permission_classes = [IsAuthenticated]

class InitiativeFeedViewSet(viewsets.ModelViewSet):
    queryset = InitiativeFeed.objects.all()
    serializer_class = InitiativeFeedSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = InitiativeFeed.objects.all()
        strategic_objective = self.request.query_params.get('strategic_objective', None)
        if strategic_objective is not None:
            queryset = queryset.filter(strategic_objective=strategic_objective)
        return queryset

# Location-related ViewSets
class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsAuthenticated]

class LandTransportViewSet(viewsets.ModelViewSet):
    queryset = LandTransport.objects.all()
    serializer_class = LandTransportSerializer
    permission_classes = [IsAuthenticated]

class AirTransportViewSet(viewsets.ModelViewSet):
    queryset = AirTransport.objects.all()
    serializer_class = AirTransportSerializer
    permission_classes = [IsAuthenticated]

class PerDiemViewSet(viewsets.ModelViewSet):
    queryset = PerDiem.objects.all()
    serializer_class = PerDiemSerializer
    permission_classes = [IsAuthenticated]

class AccommodationViewSet(viewsets.ModelViewSet):
    queryset = Accommodation.objects.all()
    serializer_class = AccommodationSerializer
    permission_classes = [IsAuthenticated]

class ParticipantCostViewSet(viewsets.ModelViewSet):
    queryset = ParticipantCost.objects.all()
    serializer_class = ParticipantCostSerializer
    permission_classes = [IsAuthenticated]

class SessionCostViewSet(viewsets.ModelViewSet):
    queryset = SessionCost.objects.all()
    serializer_class = SessionCostSerializer
    permission_classes = [IsAuthenticated]

class PrintingCostViewSet(viewsets.ModelViewSet):
    queryset = PrintingCost.objects.all()
    serializer_class = PrintingCostSerializer
    permission_classes = [IsAuthenticated]

class SupervisorCostViewSet(viewsets.ModelViewSet):
    queryset = SupervisorCost.objects.all()
    serializer_class = SupervisorCostSerializer
    permission_classes = [IsAuthenticated]

class ProcurementItemViewSet(viewsets.ModelViewSet):
    queryset = ProcurementItem.objects.all()
    serializer_class = ProcurementItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = ProcurementItem.objects.all()
        category = self.request.query_params.get('category', None)
        if category is not None:
            queryset = queryset.filter(category=category)
        return queryset

# Authentication views
@csrf_protect
def login_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            
            if not username or not password:
                return JsonResponse({
                    'detail': 'Username and password are required'
                }, status=400)
            
            user = authenticate(request, username=username, password=password)
            
            if user is not None:
                login(request, user)
                
                # Get user organizations
                user_organizations = OrganizationUser.objects.filter(user=user).select_related('organization')
                user_orgs_data = []
                
                for user_org in user_organizations:
                    user_orgs_data.append({
                        'id': user_org.id,
                        'organization': user_org.organization.id,
                        'organization_name': user_org.organization.name,
                        'role': user_org.role,
                        'created_at': user_org.created_at.isoformat() if user_org.created_at else None
                    })
                
                return JsonResponse({
                    'detail': 'Login successful',
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                    },
                    'userOrganizations': user_orgs_data
                })
            else:
                return JsonResponse({
                    'detail': 'Invalid username or password'
                }, status=401)
                
        except json.JSONDecodeError:
            return JsonResponse({
                'detail': 'Invalid JSON data'
            }, status=400)
        except Exception as e:
            return JsonResponse({
                'detail': f'Login failed: {str(e)}'
            }, status=500)
    
    return JsonResponse({'detail': 'Method not allowed'}, status=405)

@csrf_protect
def logout_view(request):
    if request.method == 'POST':
        logout(request)
        return JsonResponse({'detail': 'Logout successful'})
    return JsonResponse({'detail': 'Method not allowed'}, status=405)

def check_auth(request):
    if request.user.is_authenticated:
        # Get user organizations
        user_organizations = OrganizationUser.objects.filter(user=request.user).select_related('organization')
        user_orgs_data = []
        
        for user_org in user_organizations:
            user_orgs_data.append({
                'id': user_org.id,
                'organization': user_org.organization.id,
                'organization_name': user_org.organization.name,
                'role': user_org.role,
                'created_at': user_org.created_at.isoformat() if user_org.created_at else None
            })
        
        return JsonResponse({
            'isAuthenticated': True,
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
            },
            'userOrganizations': user_orgs_data
        })
    else:
        return JsonResponse({
            'isAuthenticated': False,
            'user': None,
            'userOrganizations': []
        })

@login_required
def update_profile(request):
    if request.method == 'PATCH':
        try:
            data = json.loads(request.body)
            user = request.user
            
            # Update allowed fields
            if 'first_name' in data:
                user.first_name = data['first_name']
            if 'last_name' in data:
                user.last_name = data['last_name']
            if 'email' in data:
                user.email = data['email']
            
            user.save()
            
            return JsonResponse({
                'detail': 'Profile updated successfully',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                }
            })
            
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'Invalid JSON data'}, status=400)
        except Exception as e:
            return JsonResponse({'detail': f'Update failed: {str(e)}'}, status=500)
    
    return JsonResponse({'detail': 'Method not allowed'}, status=405)

@login_required
def password_change(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            form = PasswordChangeForm(request.user, data)
            
            if form.is_valid():
                form.save()
                return JsonResponse({'detail': 'Password changed successfully'})
            else:
                return JsonResponse({
                    'detail': 'Password change failed',
                    'errors': form.errors
                }, status=400)
                
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'Invalid JSON data'}, status=400)
        except Exception as e:
            return JsonResponse({'detail': f'Password change failed: {str(e)}'}, status=500)
    
    return JsonResponse({'detail': 'Method not allowed'}, status=405)