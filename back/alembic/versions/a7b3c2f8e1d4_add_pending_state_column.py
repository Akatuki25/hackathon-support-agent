"""add_pending_state_column

Revision ID: a7b3c2f8e1d4
Revises: 1d8ec74fe5de
Create Date: 2026-01-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b3c2f8e1d4'
down_revision: Union[str, Sequence[str], None] = '1d8ec74fe5de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('task_hands_on', sa.Column(
        'pending_state',
        sa.JSON(),
        nullable=True,
        comment='''確認待ち状態の詳細:
        {
            "type": "choice" | "input" | "step_confirmation",
            "state": {
                "choice": {...} または "input": {...}
            },
            "entered_at": "ISO8601",
            "phase": "..."
        }'''
    ))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('task_hands_on', 'pending_state')
