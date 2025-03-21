use std::{io::{Read, Write}, error::Error};
use async_trait::async_trait;

pub mod brac;
pub mod irc;

#[async_trait]
pub trait Protocol: Send + Sync {
    async fn connect(&mut self, host: &str, ssl: bool) -> Result<(), Box<dyn Error>>;
    async fn send_message(&mut self, message: &str) -> Result<(), Box<dyn Error>>;
    async fn read_messages(&mut self) -> Result<Vec<String>, Box<dyn Error>>;
}
