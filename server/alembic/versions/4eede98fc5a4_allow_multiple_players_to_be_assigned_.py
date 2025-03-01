"""Allow multiple players to be assigned to a single user

Revision ID: 4eede98fc5a4
Revises: fdb25dd1c281
Create Date: 2025-02-22 22:08:58.247334

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4eede98fc5a4'
down_revision: Union[str, None] = 'fdb25dd1c281'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('user_sessions', sa.Column('id', sa.Integer(), sa.Identity(), nullable=False))
    op.create_index(op.f('ix_user_sessions_id'), 'user_sessions', ['id'], unique=False)
    op.drop_constraint('user_sessions_pkey', 'user_sessions', type_='primary')
    op.execute("ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_user_sessions_id'), table_name='user_sessions')
    op.drop_column('user_sessions', 'id')
    op.execute("ALTER TABLE user_sessions DROP CONSTRAINT user_sessions_pkey;")
    op.execute("ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (user_id, session_id);")


    # ### end Alembic commands ###
