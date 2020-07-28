import pathlib

import pytest
from selenium import webdriver

chrome_ext_url = 'chrome-extension://kcjbdcgbeblfmjphklkmbonkkmfoffhk/'

BASE_DIR = pathlib.Path(__file__).parent
EXTENSION_CRX_PATH = BASE_DIR.joinpath('bin', 'dist.crx')


@pytest.fixture
def chrome():
    options = webdriver.ChromeOptions()
    options.add_extension(EXTENSION_CRX_PATH)
    driver = webdriver.Chrome(options=options)
    yield driver
    driver.close()


def test_ori_found(chrome):
    chrome.get('https://2ch.hk')
    assert "Два.ч" in chrome.title
