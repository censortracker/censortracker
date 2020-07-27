from unittest import TestCase

from selenium import webdriver
from selenium.webdriver.chrome.options import Options


class TestPopup(TestCase):

    def setUp(self):
        options = webdriver.ChromeOptions()
        options.add_extension('censortracker.crx')
        self.driver = webdriver.Chrome(chrome_options=options)

    def test_ori_found(self):
        driver = self.driver
        driver.get('https://2ch.hk')
        self.assertIn("Python", driver.title)

    def tearDown(self):
        self.driver.close()
