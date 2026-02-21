import os
import pandas as pd
from config_loader import configLoader

conf = configLoader()

COLUMNS = [
    "identity", "question", "answer",
    "psychological_session", "Score", "Condition", "situation", "timeStamp"
]


def _get_file_path() -> str:
    databasepath = conf['database']['path']
    file         = conf['database']['file']
    return os.path.join(databasepath, file)


def _load_df() -> pd.DataFrame:
    """Load Excel, creating it with correct columns if missing."""
    file_path = _get_file_path()
    if not os.path.exists(file_path):
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        df = pd.DataFrame(columns=COLUMNS)
        df.to_excel(file_path, index=False)
        return df

    df = pd.read_excel(file_path)

    # ── MIGRATION: rename old Session_id column → identity if needed ──
    if 'Session_id' in df.columns and 'identity' not in df.columns:
        df.rename(columns={'Session_id': 'identity'}, inplace=True)
        df.to_excel(file_path, index=False)

    # Add any missing columns so queries never KeyError
    for col in COLUMNS:
        if col not in df.columns:
            df[col] = ""

    return df


def retrieval_by_identity(identity: str) -> pd.DataFrame:
    """Return the most recent completed row for this specific person."""
    data_df = _load_df()
    if data_df.empty:
        return pd.DataFrame(columns=COLUMNS)

    person_df = data_df[data_df['identity'] == identity].copy()
    if person_df.empty:
        return pd.DataFrame(columns=COLUMNS)

    person_df['timeStamp'] = pd.to_datetime(person_df['timeStamp'], errors='coerce')
    return person_df.sort_values('timeStamp', ascending=False).head(1)


def retrieval_last3_by_identity(identity: str) -> pd.DataFrame:
    """Return the 3 most recent rows for this specific person."""
    data_df = _load_df()
    if data_df.empty:
        return pd.DataFrame(columns=COLUMNS)

    person_df = data_df[data_df['identity'] == identity].copy()
    if person_df.empty:
        return pd.DataFrame(columns=COLUMNS)

    person_df['timeStamp'] = pd.to_datetime(person_df['timeStamp'], errors='coerce')
    return person_df.sort_values('timeStamp', ascending=False).head(3)


def insertion(user_data: dict) -> None:
    """Append one completed Q&A row to the Excel file."""
    file_path = _get_file_path()
    data_df   = _load_df()
    new_row   = pd.DataFrame({k: [v] for k, v in user_data.items()})
    data_df   = pd.concat([data_df, new_row], ignore_index=True)
    data_df.to_excel(file_path, index=False)