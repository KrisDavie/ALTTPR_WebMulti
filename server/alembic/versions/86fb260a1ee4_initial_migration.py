"""Initial migration

Revision ID: 86fb260a1ee4
Revises: 
Create Date: 2024-09-15 12:23:47.163617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '86fb260a1ee4'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('games',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(), nullable=True),
    sa.Column('description', sa.String(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_games_description'), 'games', ['description'], unique=False)
    op.create_index(op.f('ix_games_id'), 'games', ['id'], unique=False)
    op.create_index(op.f('ix_games_title'), 'games', ['title'], unique=False)
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_tokens', sa.ARRAY(sa.String()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('is_superuser', sa.Boolean(), nullable=True),
    sa.Column('discord_id', sa.String(), nullable=True),
    sa.Column('discord_username', sa.String(), nullable=True),
    sa.Column('username', sa.String(), nullable=True),
    sa.Column('avatar', sa.String(), nullable=True),
    sa.Column('email', sa.String(), nullable=True),
    sa.Column('refresh_token', sa.String(), nullable=True),
    sa.Column('supporter', sa.Boolean(), nullable=True),
    sa.Column('colour', sa.String(), nullable=True),
    sa.Column('parent_account_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['parent_account_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_discord_id'), 'users', ['discord_id'], unique=False)
    op.create_index(op.f('ix_users_discord_username'), 'users', ['discord_username'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=False)
    op.create_table('mwsessions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('game_id', sa.Integer(), nullable=True),
    sa.Column('session_password', sa.String(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('tournament', sa.Boolean(), nullable=True),
    sa.Column('mwdata', sa.JSON(), nullable=True),
    sa.ForeignKeyConstraint(['game_id'], ['games.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('session_id', sa.UUID(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('from_player', sa.Integer(), nullable=True),
    sa.Column('to_player', sa.Integer(), nullable=True),
    sa.Column('to_player_idx', sa.Integer(), nullable=True),
    sa.Column('item_id', sa.Integer(), nullable=True),
    sa.Column('location', sa.Integer(), nullable=True),
    sa.Column('event_type', sa.Enum('session_create', 'player_join', 'failed_join', 'player_leave', 'chat', 'command', 'new_item', 'player_forfeit', 'player_pause_receive', 'player_resume_receive', name='eventtypes'), nullable=True),
    sa.Column('event_data', sa.JSON(), nullable=True),
    sa.ForeignKeyConstraint(['session_id'], ['mwsessions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('session_id', 'to_player', 'to_player_idx', name='player_receive_index')
    )
    op.create_index(op.f('ix_events_event_type'), 'events', ['event_type'], unique=False)
    op.create_index(op.f('ix_events_from_player'), 'events', ['from_player'], unique=False)
    op.create_index(op.f('ix_events_id'), 'events', ['id'], unique=False)
    op.create_index(op.f('ix_events_item_id'), 'events', ['item_id'], unique=False)
    op.create_index(op.f('ix_events_location'), 'events', ['location'], unique=False)
    op.create_index(op.f('ix_events_to_player'), 'events', ['to_player'], unique=False)
    op.create_index(op.f('ix_events_to_player_idx'), 'events', ['to_player_idx'], unique=False)
    op.create_table('logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('session_id', sa.UUID(), nullable=True),
    sa.Column('player_id', sa.Integer(), nullable=True),
    sa.Column('content', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['session_id'], ['mwsessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_logs_content'), 'logs', ['content'], unique=False)
    op.create_index(op.f('ix_logs_id'), 'logs', ['id'], unique=False)
    op.create_index(op.f('ix_logs_player_id'), 'logs', ['player_id'], unique=False)
    op.create_table('owned_sessions',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['mwsessions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('user_id', 'session_id')
    )
    op.create_table('sramstores',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('session_id', sa.UUID(), nullable=True),
    sa.Column('player', sa.Integer(), nullable=True),
    sa.Column('sram', sa.JSON(), nullable=True),
    sa.Column('prev_sram', sa.JSON(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['session_id'], ['mwsessions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sramstores_id'), 'sramstores', ['id'], unique=False)
    op.create_index(op.f('ix_sramstores_player'), 'sramstores', ['player'], unique=False)
    op.create_table('user_sessions',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['mwsessions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('user_id', 'session_id')
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('user_sessions')
    op.drop_index(op.f('ix_sramstores_player'), table_name='sramstores')
    op.drop_index(op.f('ix_sramstores_id'), table_name='sramstores')
    op.drop_table('sramstores')
    op.drop_table('owned_sessions')
    op.drop_index(op.f('ix_logs_player_id'), table_name='logs')
    op.drop_index(op.f('ix_logs_id'), table_name='logs')
    op.drop_index(op.f('ix_logs_content'), table_name='logs')
    op.drop_table('logs')
    op.drop_index(op.f('ix_events_to_player_idx'), table_name='events')
    op.drop_index(op.f('ix_events_to_player'), table_name='events')
    op.drop_index(op.f('ix_events_location'), table_name='events')
    op.drop_index(op.f('ix_events_item_id'), table_name='events')
    op.drop_index(op.f('ix_events_id'), table_name='events')
    op.drop_index(op.f('ix_events_from_player'), table_name='events')
    op.drop_index(op.f('ix_events_event_type'), table_name='events')
    op.drop_table('events')
    op.drop_table('mwsessions')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_discord_username'), table_name='users')
    op.drop_index(op.f('ix_users_discord_id'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_games_title'), table_name='games')
    op.drop_index(op.f('ix_games_id'), table_name='games')
    op.drop_index(op.f('ix_games_description'), table_name='games')
    op.drop_table('games')
    # ### end Alembic commands ###
