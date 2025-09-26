import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services.plan_generator_service import PlanGeneratorService, PlanResult, PhasePlan

router = APIRouter()


class PlanRequest(BaseModel):
    project_id: uuid.UUID


@router.post("/", response_model=PlanResult)
def generate_plan(request: PlanRequest, db: Session = Depends(get_db)) -> PlanResult:
    service = PlanGeneratorService(db=db)
    try:
        return service.generate_plan(project_id=request.project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{project_id}", response_model=PlanResult)
def get_plan(project_id: uuid.UUID, db: Session = Depends(get_db)) -> PlanResult:
    service = PlanGeneratorService(db=db)
    try:
        return service.get_plan(project_id=project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{project_id}/phase/{phase}/details", response_model=PhasePlan)
def generate_phase_details(
    project_id: uuid.UUID,
    phase: str,
    db: Session = Depends(get_db),
) -> PhasePlan:
    service = PlanGeneratorService(db=db)
    try:
        normalized_phase = phase.upper()
        return service.generate_phase_details(project_id=project_id, phase=normalized_phase)  # type: ignore[arg-type]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
