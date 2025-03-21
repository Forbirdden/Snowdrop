use std::{path::PathBuf, sync::{Arc, Mutex}};
use serde::{Serialize, Deserialize};
use clap::Parser;
use homedir::my_home;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ProtocolType {
    BRAC,
    IRC
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerConfig {
    pub alias: String,
    pub host: String,
    pub protocol: ProtocolType,
    pub ssl: bool,
    pub channels: Vec<String>,
    #[serde(skip)]
    pub connection: Option<Arc<Mutex<dyn crate::proto::Protocol>>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub servers: Vec<ServerConfig>,
    pub update_interval: u64,
    pub theme: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            servers: vec![],
            update_interval: 100,
            theme: "default".into(),
        }
    }
}

#[derive(Parser, Debug)]
#[command(version, about)]
pub struct CliArgs {
    #[arg(short, long)]
    pub config: Option<PathBuf>,
    #[arg(short, long)]
    pub add_server: bool,
}

pub fn load_config(path: Option<PathBuf>) -> Result<AppConfig, ConfigError> {
    let path = path.unwrap_or_else(|| default_config_path());
    
    if !path.exists() {
        let default_config = AppConfig::default();
        save_config(&default_config, &path)?;
    }
    
    let content = std::fs::read_to_string(path)?;
    Ok(serde_yml::from_str(&content)?)
}

pub fn save_config(config: &AppConfig, path: &PathBuf) -> Result<(), ConfigError> {
    let content = serde_yml::to_string(config)?;
    std::fs::write(path, content)?;
    Ok(())
}

fn default_config_path() -> PathBuf {
    let mut path = my_home().unwrap().unwrap();
    path.push(".brac_config.yml");
    path
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("IO error")]
    Io(#[from] std::io::Error),
    #[error("Serialization error")]
    Serde(#[from] serde_yml::Error),
}