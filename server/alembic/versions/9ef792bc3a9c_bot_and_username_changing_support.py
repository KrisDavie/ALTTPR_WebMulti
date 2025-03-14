"""Bot and Username changing support

Revision ID: 9ef792bc3a9c
Revises: 0b55c84c67f1
Create Date: 2025-01-11 20:18:51.606794

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ef792bc3a9c'
down_revision: Union[str, None] = '0b55c84c67f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('api_keys',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('key', sa.String(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('description', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('last_used', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_api_keys_id'), 'api_keys', ['id'], unique=False)
    op.create_index(op.f('ix_api_keys_key'), 'api_keys', ['key'], unique=True)
    op.add_column('user_sessions', sa.Column('player_id', sa.Integer()))
    op.add_column('users', sa.Column('bot', sa.Boolean(), server_default='false'))
    op.add_column('users', sa.Column('username_as_player_name', sa.Boolean(), server_default='false'))
    op.add_column('users', sa.Column('discord_display_name', sa.String(), nullable=True))
    op.add_column('users', sa.Column('bot_owner_id', sa.Integer(), nullable=True))
    op.drop_index('ix_users_username', table_name='users')
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_foreign_key(None, 'users', 'users', ['bot_owner_id'], ['id'])
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint('users_bot_owner_id_fkey', 'users', type_='foreignkey')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.create_index('ix_users_username', 'users', ['username'], unique=False)
    op.drop_column('users', 'bot_owner_id')
    op.drop_column('users', 'discord_display_name')
    op.drop_column('users', 'username_as_player_name')
    op.drop_column('users', 'bot')
    op.drop_column('user_sessions', 'player_id')
    op.drop_index(op.f('ix_api_keys_key'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_id'), table_name='api_keys')
    op.drop_table('api_keys')
    # ### end Alembic commands ###
